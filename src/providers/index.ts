import { ModelProviderID } from "~/settings/models/providers";
import ObsidianAgentsServer from "..";

export class ModelProvider {
	id: ModelProviderID;
	baseUrl: string;
	models: string[];

	constructor(plugin: ObsidianAgentsServer, id: string) {
		const provider = plugin.settings.modelProviders.find(p => p.id === id)
		if (provider) {
			this.id = provider.id
			this.baseUrl = provider.baseUrl
			this.getModels().then(models => {
				this.models = models
			}).catch(e => {
				console.error('error fetching models: ', e)
			})
		}
	}

	async getModels(): Promise<string[]> {
		return []
	}
}
