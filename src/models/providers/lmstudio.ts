import { ModelProvider } from ".";
import { MODEL_PROVIDERS, ModelProviderSettings } from "~/models/providers/constants";
import ObsidianAgentsServer from "~/index";
import { requestUrl } from "obsidian";
import { OpenAICompatibleProvider } from "@ai-sdk/openai-compatible";
import { GetModelsResponse } from "~/agents/chatCompletionApiTypes";

export class LMStudio extends ModelProvider {
  id = MODEL_PROVIDERS.lmstudio.id;
  baseURL = MODEL_PROVIDERS["lmstudio"].baseURL;
  apiKeyRequired = MODEL_PROVIDERS["lmstudio"].apiKeyRequired;
  models = [];
  instance?: OpenAICompatibleProvider;

  constructor(plugin: ObsidianAgentsServer, providerSettings: ModelProviderSettings) {
    // super calls both initializeProvider & 
    super(plugin, providerSettings)
  }

  async getModels() {
    const res = await requestUrl(`${this.baseURL}/models`)
    if (res.status === 200) {
      const models = (res.json.data as GetModelsResponse).map(m => m.id)
      return models
    }
    return []
  }
}
