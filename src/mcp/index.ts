// Import MCP types and utilities
import { tool, Tool } from "@openai/agents"
import ObsidianAgentsServer from ".."
import { MCPServerConfig } from "~/settings/types"
import { AgentSettings } from "~/agents/types"
import { SimpleMCPServerStdio } from "./stdio"
import { SimpleMCPServerSSE } from "./sse"
import z from "zod"

export class MCPManager {
	private servers: Map<string, SimpleMCPServerStdio | SimpleMCPServerSSE> = new Map()
	private plugin: ObsidianAgentsServer

	constructor(plugin: ObsidianAgentsServer) {
		this.plugin = plugin
	}

	async initializeServers(): Promise<void> {
		await this.closeAll()

		for (const config of this.plugin.settings.mcpServers) {
			if (!config.enabled) continue
			try {
				const server = await this.createServer(config)
				await server.connect()
				this.servers.set(config.id, server)
			} catch (err) {
				console.error(`[MCP] Failed to connect to ${config.name}: `, err)
			}
		}
	}

	private convertStdioArgs(args: string) {
		return args.split(",").map(a => a.trim()).filter(Boolean)
	}

	private convertEnvArrayToRecord(envArray?: { name: string, value: string }[]): Record<string, string> {
		if (!envArray || envArray.length === 0) return {}

		return envArray.reduce((acc, { name, value }) => {
			acc[name] = value
			return acc
		}, {} as Record<string, string>)
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

	getServer(id: string): SimpleMCPServerStdio | SimpleMCPServerSSE | undefined {
		return this.servers.get(id)
	}

	async getServerTools(id: string): Promise<string[]> {
		const server = this.servers.get(id)
		if (!server) return [];

		try {
			const mcpTools = await server.listTools()
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
				console.warn(`[MCP] Tool config missing mcpServerID`)
				continue
			}

			const server = this.servers.get(toolConfig.serverID)
			if (!server) {
				console.warn("[MCP] Server not found: ", toolConfig.serverID)
				continue
			}

			try {
				const mcpTools = await server.listTools()

				// Filter tools if specific IDs are configured
				const toolsToConvert = toolConfig.toolIDs && toolConfig.toolIDs.length > 0
					? mcpTools.filter(t => toolConfig.toolIDs!.includes(t.name))
					: mcpTools

				// Convert MCP tools to Agent SDK tools
				for (const mcpTool of toolsToConvert) {
					const agentTool: Tool = tool({
						name: mcpTool.name,
						description: mcpTool.description || "",
						parameters: z.object({
							args: z.record(z.string(), z.string())
						}),
						async execute(args: Record<string, unknown>) {
							try {
								const result = await server.callTool(mcpTool.name, args)
								return JSON.stringify(result)
							} catch (err) {
								console.error(`[MCP] Error executing tool ${mcpTool.name}:`, err)
								throw err
							}
						}
					})
					tools.push(agentTool)
				}
			} catch (err) {
				console.error(`[MCP] Error getting tools from ${server.name}: `, err)
			}
		}

		return tools
	}

	async closeAll(): Promise<void> {
		for (const [id, server] of this.servers) {
			try {
				await server.close()
				console.log(`[MCP] Closed server: ${id}`)
			} catch (err) {
				console.error(`[MCP] Error closing server ${id}: `, err)
			}
		}
	}
}
