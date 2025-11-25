import { ModelProviderID } from "~/models/providers/constants";
import ObsidianAgentsServer from "~/index";
import { type OpenAICompatibleProvider } from "@ai-sdk/openai-compatible";

export type InterfaceUnion = OpenAICompatibleProvider

export class ModelProvider {
	id: ModelProviderID;
	baseURL: string;
	models: string[];
	plugin: ObsidianAgentsServer
	instance?: InterfaceUnion

	constructor(plugin: ObsidianAgentsServer, id: string) {
		const provider = plugin.settings.modelProviders.find(p => p.id === id)
		if (provider) {
			this.id = provider.id
			this.baseURL = provider.baseURL
			this.plugin = plugin
			if (this.shouldCreateInstance()) {
				this.createInstance();
			}
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

	shouldCreateInstance(): boolean {
		const agent = this.plugin.settings.agents.some(agent => {
			return agent.enabled && agent.modelProvider == this.id
		})
		if (!agent) return false;
		return true
	}

	createInstance(): void {
	}
}
