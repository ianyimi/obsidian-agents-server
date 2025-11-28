import { ModelProviderID } from "~/models/providers/constants"
import { ToolType } from "~/tools/types";

export interface AgentSettings {
	id: string,
	name: string,
	enabled: boolean,
	instructions: string,
	modelProvider: ModelProviderID
	model: string
	tools: {
		enabled: boolean;
		type: ToolType;
		description?: string;
	}[]
}
