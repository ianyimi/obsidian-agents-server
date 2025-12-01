// Import MCP types and utilities
import { tool, Tool } from "@openai/agents"
import ObsidianAgentsServer from ".."
import { MCPServerConfig } from "~/settings/types"
import { AgentSettings } from "~/agents/types"
import { SimpleMCPServerStdio } from "./stdio"
import { SimpleMCPServerSSE } from "./sse"

// MCP Tool types from specification
export interface MCPTool {
	name: string
	description?: string
	inputSchema: {
		type: "object"
		properties?: Record<string, any>
		required?: string[]
		[key: string]: any
	}
}

export interface MCPServer {
	id: string
	status: "connected" | "error" | "disabled"
	server: SimpleMCPServerStdio | SimpleMCPServerSSE
	lastChecked: number
	error?: string
}

export class MCPManager {
	public servers: Map<string, MCPServer> = new Map()
	private plugin: ObsidianAgentsServer

	constructor(plugin: ObsidianAgentsServer) {
		this.plugin = plugin
	}

	getServerStatus(id: string): MCPServer | undefined {
		return this.servers.get(id)
	}

	async initializeServers(): Promise<void> {
		await this.closeAll()

		for (const config of this.plugin.settings.mcpServers) {
			if (!config.enabled) {
				this.servers.set(config.id, {
					id: config.id,
					status: "disabled",
					server: null as any, // No server instance for disabled servers
					lastChecked: Date.now()
				})
				continue
			}

			try {
				const server = await this.createServer(config)
				await server.connect()
				this.servers.set(config.id, {
					id: config.id,
					status: "connected",
					server,
					lastChecked: Date.now()
				})
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : String(err)
				console.error(`[MCP] Failed to connect to ${config.name}: `, err)
				this.servers.set(config.id, {
					id: config.id,
					status: "error",
					server: null as any,
					lastChecked: Date.now(),
					error: errorMessage
				})
			}
		}
	}

	private convertStdioArgs(args: string) {
		return args.split(",").map(a => a.trim()).filter(Boolean)
	}

	private convertEnvArrayToRecord(envArray?: { name: string, value: string }[]): Record<string, string> {
		if (!envArray || envArray.length === 0) {
			console.warn('[MCP] No env variables provided in config')
			return {}
		}

		const result = envArray.reduce((acc, { name, value }) => {
			acc[name] = value
			return acc
		}, {} as Record<string, string>)

		return result
	}

	private async createServer(config: MCPServerConfig): Promise<SimpleMCPServerStdio | SimpleMCPServerSSE> {
		switch (config.type) {
			case "stdio":
				return new SimpleMCPServerStdio({
					command: config.command,
					args: this.convertStdioArgs(config.args),
					env: this.convertEnvArrayToRecord(config.env),
					name: config.name,
					cacheToolsList: config.cacheToolsList ?? true
				})
			case "sse":
				return new SimpleMCPServerSSE({
					url: config.url,
					name: config.name,
					cacheToolsList: config.cacheToolsList
				})
		}
	}

	async getServerTools(id: string): Promise<string[]> {
		const mcpServer = this.servers.get(id)
		if (!mcpServer || mcpServer.status !== "connected") return []

		try {
			const mcpTools = await mcpServer.server.listTools()
			return mcpTools.map(t => t.name)
		} catch (err) {
			console.error(`[MCP] Error listing tools from ${id}: `, err)
			return []
		}
	}

	async getToolsForAgent(agentSettings: AgentSettings): Promise<Tool[]> {
		const tools: Tool[] = []

		for (const toolConfig of agentSettings.mcpTools) {
			if (!toolConfig.enabled || toolConfig.type.id !== "mcp") continue;
			if (!toolConfig.serverID) {
				console.warn(`[MCP] Tool config missing serverID`)
				continue
			}

			const mcpServer = this.servers.get(toolConfig.serverID)
			if (!mcpServer || mcpServer.status !== "connected") {
				console.warn("[MCP] Server not found or not connected: ", toolConfig.serverID)
				continue
			}

			const server = mcpServer.server

			try {
				const mcpTools = await server.listTools()
				const toolsToConvert = mcpTools.filter(t => toolConfig.toolIDs.includes(t.name))

				for (const mcpTool of toolsToConvert) {
					tools.push(
						tool({
							name: mcpTool.name,
							description: mcpTool.description || "",
							parameters: mcpTool.inputSchema as any,
							strict: false, // Use non-strict mode for JSON Schema
							async execute(args: Record<string, unknown>) {
								try {
									const result = await server.callTool(mcpTool.name, args)

									// MCP tools return content array - extract text from first content item
									if (Array.isArray(result)) {
										// Result is MCP content array: [{ type: "text", text: "..." }]
										const textContent = result.find(item => item.type === 'text')
										if (textContent && textContent.text) {
											const extractedText = textContent.text
											return extractedText
										}
									}

									// Fallback: return result as-is, let agents-sdk handle serialization
									return result
								} catch (err) {
									console.error(`[MCP] Error executing tool ${mcpTool.name}:`, err)
									throw err
								}
							}
						})
					)
				}
			} catch (err) {
				console.error(`[MCP] Error getting tools from server: `, err)
			}
		}

		return tools
	}

	async testConnection(serverID: string): Promise<{ success: boolean, error?: string }> {
		const config = this.plugin.settings.mcpServers.find(s => s.id === serverID)
		if (!config) {
			return { success: false, error: "Server configuration not found" }
		}

		try {
			const server = await this.createServer(config)
			await server.connect()
			await server.close()

			// Update status to connected
			this.servers.set(serverID, {
				id: serverID,
				status: "connected",
				server: null as any, // Don't keep the test connection alive
				lastChecked: Date.now()
			})

			return { success: true }
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : String(err)

			// Update status to error
			this.servers.set(serverID, {
				id: serverID,
				status: "error",
				server: null as any,
				lastChecked: Date.now(),
				error: errorMessage
			})

			return { success: false, error: errorMessage }
		}
	}

	async closeAll(): Promise<void> {
		for (const [id, mcpServer] of this.servers) {
			if (mcpServer.status === "connected" && mcpServer.server) {
				try {
					await mcpServer.server.close()
				} catch (err) {
					console.error(`[MCP] Error closing server ${id}: `, err)
				}
			}
		}
		this.servers.clear()
	}
}
