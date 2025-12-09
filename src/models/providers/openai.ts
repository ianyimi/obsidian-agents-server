import { ModelProvider } from ".";
import { MODEL_PROVIDERS, ModelProviderSettings } from "~/models/providers/constants";
import ObsidianAgentsServer from "~/index";
import { requestUrl } from "obsidian";
import { encode, encodeChat } from "gpt-tokenizer"
import { ChatCompletionMessage } from "~/agents/chatCompletionApiTypes";
import { ChatMessage } from "gpt-tokenizer/esm/functionCalling";

type GetModelsResponse = {
	id: string;
	object: string;
	owned_by: string;
}[]

export class OpenAI extends ModelProvider {
	id = MODEL_PROVIDERS.openai.id;
	baseURL = MODEL_PROVIDERS["openai"].baseURL;
	models = [];
	apiKeyRequired = MODEL_PROVIDERS["openai"].apiKeyRequired;

	constructor(plugin: ObsidianAgentsServer, providerSettings: ModelProviderSettings) {
		super(plugin, providerSettings)
	}

	async getModels() {
		if (!this.apiKey) {
			console.warn('[OpenAI] No API key configured')
			return []
		}

		try {
			const res = await requestUrl({
				url: `${this.baseURL}/models`,
				headers: {
					'Authorization': `Bearer ${this.apiKey}`
				}
			})

			if (res.status === 200) {
				const models = (res.json.data as GetModelsResponse)
					.filter(m => m.id.startsWith('gpt-')) // Only include GPT models
					.map(m => m.id)
				return models
			}
		} catch (e) {
			console.error('[OpenAI] Error fetching models:', e)
		}
		return []
	}

	createInstance() {
		// OpenAI doesn't need an instance - the SDK supports it natively
		// We just need to set the API key in the environment
		if (this.apiKey) {
			process.env.OPENAI_API_KEY = this.apiKey
		}
	}

	countTokens({ text, model }: { text: string, model?: string }) {
		return encode(text).length
	}

	countMessages({ messages, model }: { messages: ChatCompletionMessage[]; model?: string; }): number {
		const chatMessages: ChatMessage[] = messages.map(m => {
			const content = typeof m.content === "string"
				? m.content
				: Array.isArray(m.content)
					? m.content.map(part => "text" in part ? part.text : "").join("\n")
					: ""
			return {
				role: m.role,
				content
			}
		})
		const tokens = encodeChat(chatMessages, "gpt-4")
		return tokens.length
	}
}
