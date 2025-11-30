import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { existsSync, readdirSync } from "fs"
import { homedir } from "os"
import { join } from "path"

/**
 * Attempts to resolve a command to an absolute path by checking common installation locations.
 * This is necessary because GUI apps on macOS don't inherit the same PATH as terminal apps.
 */
function resolveCommand(command: string): string {
	// If already absolute path, return as-is
	if (command.startsWith("/")) {
		return command
	}

	// For node/npx, check version managers first
	if (command === "npx" || command === "node") {
		const resolved = findNodeExecutable(command)
		if (resolved) return resolved
	}

	// Check common bin directories
	const commonPaths = [
		"/opt/homebrew/bin",
		"/usr/local/bin",
		"/usr/bin",
	]

	for (const basePath of commonPaths) {
		const fullPath = join(basePath, command)
		if (existsSync(fullPath)) {
			return fullPath
		}
	}

	// If not found, return original command and let it fail naturally
	return command
}

/**
 * Find node/npx in common version manager locations (fnm, nvm)
 */
function findNodeExecutable(command: "node" | "npx"): string | null {
	const homeDir = homedir()

	// Try fnm (Fast Node Manager)
	const fnmPath = join(homeDir, ".local/share/fnm/node-versions")
	if (existsSync(fnmPath)) {
		try {
			const versions = readdirSync(fnmPath)
				.filter((v: string) => v.startsWith("v") && !v.startsWith("."))
				.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))

			for (const version of versions) {
				const binPath = join(fnmPath, version, "installation/bin", command)
				if (existsSync(binPath)) {
					return binPath
				}
			}
		} catch (err) {
			console.warn(`[MCP] Error checking fnm path:`, err)
		}
	}

	// Try nvm (Node Version Manager)
	const nvmPath = join(homeDir, ".nvm/versions/node")
	if (existsSync(nvmPath)) {
		try {
			const versions = readdirSync(nvmPath)
				.filter((v: string) => v.startsWith("v") && !v.startsWith("."))
				.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))

			for (const version of versions) {
				const binPath = join(nvmPath, version, "bin", command)
				if (existsSync(binPath)) {
					return binPath
				}
			}
		} catch (err) {
			console.warn(`[MCP] Error checking nvm path:`, err)
		}
	}

	return null
}

export class SimpleMCPServerStdio {
	private client?: Client
	private transport?: StdioClientTransport
	private config: any
	private tools: any[] = []

	constructor(config: any) {
		this.config = config
	}

	get name() {
		return this.config.name
	}

	async connect() {
		// Resolve command to absolute path if needed
		const resolvedCommand = resolveCommand(this.config.command)

		// If we resolved the command to an absolute path, add its directory to PATH
		// This ensures child processes spawned by the command can find node/npm/etc
		const mergedEnv = {
			...process.env,
			...this.config.env
		}

		if (resolvedCommand !== this.config.command && resolvedCommand.includes('/')) {
			const commandDir = resolvedCommand.substring(0, resolvedCommand.lastIndexOf('/'))
			const currentPath = mergedEnv.PATH || process.env.PATH || ''

			// Add command directory to PATH if not already present
			if (!currentPath.split(':').includes(commandDir)) {
				mergedEnv.PATH = `${commandDir}:${currentPath}`
			}
		}

		this.transport = new StdioClientTransport({
			command: resolvedCommand,
			args: this.config.args || [],
			env: mergedEnv
		})

		this.client = new Client(
			{ name: 'obsidian-agents-server', version: '1.0.0' },
			{ capabilities: {} }
		)

		try {
			await this.client.connect(this.transport)
			console.log(`[MCP] Successfully connected to ${this.config.name}`)
		} catch (err) {
			console.error(`[MCP] Connection error for ${this.config.name}:`, err)
			throw err
		}
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
