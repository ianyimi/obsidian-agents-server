import { z } from "zod"
import { type Tool } from "@openai/agents"

export const TOOL_TYPES = {
	null: {
		id: "",
		label: ""
	},
	vault: {
		id: "vault",
		label: "Vault Tools"
	},
	mcp: {
		id: "mcp",
		label: "MCP Server"
	},
	custom: {
		id: "custom",
		label: "Custom Function"
	}
} as const
export type ToolType = typeof TOOL_TYPES[keyof typeof TOOL_TYPES]

export const SUPPORTED_PLUGINS = {
	templater: {
		id: "templater-obsidian",
		label: "Templater"
	},
	omnisearch: {
		id: "omnisearch",
		label: "Omnisearch"
	}
} as const
export type SupportedPlugin = typeof SUPPORTED_PLUGINS[keyof typeof SUPPORTED_PLUGINS]
export type SupportedPluginIDs = typeof SUPPORTED_PLUGINS[keyof typeof SUPPORTED_PLUGINS]["id"]

export interface AgentTool {
	id: string,
	type: ToolType,
	tool: Tool
	plugins: SupportedPluginIDs[]
}

export const ModifyFileOptionsSchema = z.object({
	ctime: z.number().nullable().default(null),
	mtime: z.number().nullable().default(null)
})
