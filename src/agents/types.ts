import { MODEL_PROVIDERS, ModelProviderID } from "~/models/providers/constants"
import { TOOL_TYPES, ToolType } from "~/tools/types";
import { VaultToolsID } from "~/tools/vault";
import { z } from "zod"

export const agentSettingsSchema = z.object({
	// id: z.string(),
	name: z.string(),
	enabled: z.boolean(),
	useAsTool: z.boolean(),
	toolName: z.string(),
	toolDescription: z.string(),
	instructions: z.string(),
	collapsed: z.boolean(),
	modelProvider: z.enum([MODEL_PROVIDERS.ollama.id, MODEL_PROVIDERS.lmstudio.id]),
	model: z.string(),
	agentTools: z.array(z.string()),
	vaultTools: z.record(z.enum([
		"get_agents_settings",
		"omni_search",
		"read_file",
		"count_notes",
		"create_file",
		"delete_file",
		"update_file",
		"restart_agents_server",
		"update_agents_settings",
		"create_file_from_template"
	]), z.boolean()),
	mcpTools: z.array(z.object({
		enabled: z.boolean(),
		type: z.enum([TOOL_TYPES.vault.id, TOOL_TYPES.custom.id]),
		serverID: z.string(),
		toolsID: z.array(z.string())
	})),
	tools: z.array(z.object({
		enabled: z.boolean(),
		type: z.enum([TOOL_TYPES.vault.id, TOOL_TYPES.mcp.id, TOOL_TYPES.custom.id]),
		// description: z.string(),
		// customToolsPath: z.array(z.string())
	}))
})

type AS = z.infer<typeof agentSettingsSchema>

export interface AgentSettings {
	id: string,
	name: string,
	enabled: boolean,
	useAsTool: boolean,
	toolName: string,
	toolDescription: string,
	instructions: string,
	collapsed: boolean,
	modelProvider: ModelProviderID
	model: string
	agentTools: string[]
	vaultTools: Record<VaultToolsID, boolean>
	mcpTools: {
		enabled: boolean,
		type: Extract<ToolType, { id: "mcp" }>
		serverID: string,
		toolIDs: string[]
	}[],
	tools: {
		enabled: boolean,
		type: ToolType,
		description?: string,
		customToolPath?: string
	}[]
}
