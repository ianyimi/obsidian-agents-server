import { ModelProvider } from ".";
import { MODEL_PROVIDERS, ModelProviderSettings } from "~/models/providers/constants";
import ObsidianAgentsServer from "~/index";
import { requestUrl } from "obsidian";
import { createOpenAI, OpenAIProvider as AISDKOpenAIProvider } from "@ai-sdk/openai";
import { GetModelsResponse } from "~/agents/chatCompletionApiTypes";

export class OpenAI extends ModelProvider {
  id = MODEL_PROVIDERS.openai.id;
  baseURL = MODEL_PROVIDERS["openai"].baseURL;
  models = [];
  apiKeyRequired = MODEL_PROVIDERS["openai"].apiKeyRequired;
  instance?: AISDKOpenAIProvider;

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
    if (!this.apiKey) {
      console.warn('[OpenAI] No API key configured for creating instance')
      return
    }

    this.instance = createOpenAI({
      apiKey: this.apiKey,
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
