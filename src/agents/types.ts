import { ModelProviderID } from "~/models/providers/constants"
import { ToolType } from "~/tools/types";
import { VaultToolsID } from "~/tools/vault";

export interface AgentSettings {
	id: string,
	name: string,
	enabled: boolean,
	instructions: string,
	collapsed: boolean,
	modelProvider: ModelProviderID
	model: string
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
