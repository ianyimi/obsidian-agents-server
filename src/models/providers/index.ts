import { ModelProviderID, ModelProviderSettings } from "~/models/providers/constants";
import ObsidianAgentsServer from "~/index";
import { type OpenAICompatibleProvider } from "@ai-sdk/openai-compatible";
import { ChatCompletionMessage } from "~/agents/chatCompletionApiTypes";

export type InterfaceUnion = OpenAICompatibleProvider

export abstract class ModelProvider {
	id: ModelProviderID;
	baseURL: string;
	models: string[];
	plugin: ObsidianAgentsServer
	instance?: InterfaceUnion
	apiKeyRequired: boolean = false
	apiKey?: string

	constructor(plugin: ObsidianAgentsServer, providerSettings: ModelProviderSettings) {
		const provider = plugin.settings.modelProviders.find(p => p.id === providerSettings.id)
		if (provider) {
			this.id = provider.id
			this.baseURL = provider.baseURL
			this.plugin = plugin
			if (providerSettings.apiKey) {
				this.apiKey = providerSettings.apiKey
			}
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

	shouldCreateInstance(): boolean {
		const agent = this.plugin.settings.agents.some(agent => {
			return agent.enabled && agent.modelProvider == this.id
		})
		if (!agent) return false;
		return true
	}

	abstract getModels(): Promise<string[]>
	abstract createInstance(): void

	abstract countTokens({ text, model }: { text: string, model?: string }): number
	abstract countMessages({ messages, model }: { messages: ChatCompletionMessage[], model?: string }): number
}
