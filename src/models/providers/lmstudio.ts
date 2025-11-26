import { ModelProvider } from ".";
import { MODEL_PROVIDERS } from "~/models/providers/constants";
import ObsidianAgentsServer from "~/index";
import { requestUrl } from "obsidian";
import { createOpenAICompatible, OpenAICompatibleProvider } from "@ai-sdk/openai-compatible";

type GetModelsResponse = {
	id: string;
	object: string;
	owned_by: string;
}[]

export class LMStudio extends ModelProvider {
	id = MODEL_PROVIDERS.lmstudio.id;
	baseURL = MODEL_PROVIDERS["lmstudio"].baseURL;
	models = [];
	instance?: OpenAICompatibleProvider

	constructor(plugin: ObsidianAgentsServer) {
		// super calls both initializeProvider & 
		super(plugin, MODEL_PROVIDERS.lmstudio.id)
	}

	async getModels() {
		const res = await requestUrl(`${this.baseURL}/models`)
		if (res.status === 200) {
			const models = (res.json.data as GetModelsResponse).map(m => m.id)
			return models
		}
		return []
	}

	createInstance() {
		this.instance = createOpenAICompatible({
			name: this.id,
			baseURL: this.baseURL,
			fetch: async (url: string | URL | Request, init?: RequestInit) => {
				const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

				const response = await requestUrl({
					url: urlString,
					method: init?.method || 'GET',
					headers: init?.headers as Record<string, string>,
					body: init?.body as string,
				});

				return new Response(response.text, {
					status: response.status,
					headers: response.headers,
				});
			}
		})
	}
}
