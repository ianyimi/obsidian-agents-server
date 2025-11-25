import { ModelProviderID } from "~/settings/models/providers"

export interface Agent {
	name: string,
	instructions: string,
	modelProvider: ModelProviderID
	model: string
}
