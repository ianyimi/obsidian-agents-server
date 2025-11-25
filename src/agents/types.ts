import { ModelProviderID } from "~/models/providers/constants"

export interface Agent {
	name: string,
	enabled: boolean,
	instructions: string,
	modelProvider: ModelProviderID
	model: string
}
