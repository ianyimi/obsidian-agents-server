export const MODEL_PROVIDERS = {
	openai: {
		id: "openai",
		label: "OpenAI",
		baseURL: "https://api.openai.com/v1",
		apiKeyRequired: true
	},
	lmstudio: {
		id: "lmstudio",
		label: "LMStudio",
		baseURL: "http://localhost:1234/v1",
		apiKeyRequired: false
	},
	ollama: {
		id: "ollama",
		label: "Ollama",
		baseURL: "http://localhost:11434",
		apiKeyRequired: false
	}
} as const
export type ModelProviderID = typeof MODEL_PROVIDERS[keyof typeof MODEL_PROVIDERS]["id"]
export type ModelProviderLabel = typeof MODEL_PROVIDERS[keyof typeof MODEL_PROVIDERS]["label"]

export interface ModelProviderSettings {
	id: ModelProviderID,
	label: string,
	baseURL: string,
	apiKey?: string
}
