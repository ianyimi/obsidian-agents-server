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
      this.models = [] // Initialize to empty array
      if (providerSettings.apiKey) {
        this.apiKey = providerSettings.apiKey
      }
      if (this.shouldCreateInstance()) {
        this.createInstance();
      }

      // Fetch models with timeout - don't block initialization
      this.fetchModelsWithTimeout();
    }
  }

  private async fetchModelsWithTimeout() {
    try {
      // Race between getModels() and a timeout
      const timeoutPromise = new Promise<string[]>((_, reject) =>
        setTimeout(() => reject(new Error('Model fetch timeout')), 5000) // 5 second timeout
      );

      const models = await Promise.race([
        this.getModels(),
        timeoutPromise
      ]);

      this.models = models;
      console.log(`[${this.id}] Successfully fetched ${models.length} models`);
    } catch (e) {
      console.warn(`[${this.id}] Failed to fetch models (offline or timeout):`, e);
      this.models = []; // Fallback to empty array
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
