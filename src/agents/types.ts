import { ModelProviderID } from "~/models/providers/constants"
import { ToolType } from "~/tools/types";
import { VaultToolsID } from "~/tools/vault";

export interface AgentSettings {
	id: string,
	name: string,
	enabled: boolean,
	instructions: string,
	modelProvider: ModelProviderID
	model: string
	vaultTools: Record<VaultToolsID, boolean>
	tools: {
		enabled: boolean;
		type: ToolType;
		description?: string;
	}[]
}
