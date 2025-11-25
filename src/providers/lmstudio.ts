import { ModelProvider } from ".";
import { MODEL_PROVIDERS } from "~/settings/models/providers";
import ObsidianAgentsServer from "..";
import { requestUrl } from "obsidian";

type GetModelsResponse = {
	id: string;
	object: string;
	owned_by: string;
}[]

export class LMStudio extends ModelProvider {
	id = MODEL_PROVIDERS.lmstudio.id;
	baseUrl = MODEL_PROVIDERS["lmstudio"].baseUrl;
	models = [];

	constructor(plugin: ObsidianAgentsServer) {
		super(plugin, MODEL_PROVIDERS.lmstudio.id)
	}

	async getModels() {
		const res = await requestUrl(`${this.baseUrl}/models`)
		if (res.status === 200) {
			const models = (res.json.data as GetModelsResponse).map(m => m.id)
			return models
		}
		return []
	}
}
