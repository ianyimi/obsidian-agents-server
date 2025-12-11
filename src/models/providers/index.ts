import { ModelProviderID, ModelProviderSettings } from "~/models/providers/constants";
import ObsidianAgentsServer from "~/index";
import { createOpenAICompatible, type OpenAICompatibleProvider } from "@ai-sdk/openai-compatible";
import { type OpenAIProvider } from "@ai-sdk/openai";
import { requestUrl } from "obsidian";

export type ModelProviderInstance = OpenAICompatibleProvider | OpenAIProvider

export abstract class ModelProvider {
  id: ModelProviderID;
  baseURL: string;
  models: string[];
  plugin: ObsidianAgentsServer
  instance?: ModelProviderInstance
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

  createInstance() {
    this.instance = createOpenAICompatible({
      name: this.id,
      baseURL: this.baseURL,
      includeUsage: true,
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

  abstract getModels(): Promise<string[]>
}
