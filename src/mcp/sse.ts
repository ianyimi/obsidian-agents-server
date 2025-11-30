import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"

export class SimpleMCPServerSSE {
	private client?: Client
	private transport?: SSEClientTransport
	private config: any
	private tools: any[] = []

	constructor(config: any) {
		this.config = config
	}

	get name() {
		return this.config.name
	}

	async connect() {
		this.transport = new SSEClientTransport(new URL(this.config.url))

		this.client = new Client(
			{ name: 'obsidian-agents-server', version: '1.0.0' },
			{ capabilities: {} }
		)

		await this.client.connect(this.transport)
	}

	async close() {
		await this.client?.close()
		this.client = undefined
		this.transport = undefined
	}

	async listTools() {
		if (!this.client) throw new Error('Client not connected')
		const response = await this.client.listTools()
		this.tools = response.tools
		return response.tools
	}

	async callTool(name: string, args: Record<string, unknown> | null) {
		if (!this.client) throw new Error('Client not connected')
		const result = await this.client.callTool({ name, arguments: args || {} })
		return result.content
	}
}
