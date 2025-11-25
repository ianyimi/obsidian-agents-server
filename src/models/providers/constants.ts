export const MODEL_PROVIDERS = {
	lmstudio: {
		id: "lmstudio",
		label: "LMStudio",
		baseURL: "http://localhost:1234/v1"
	},
	ollama: {
		id: "ollama",
		label: "Ollama",
		baseURL: "http://localhost:11434"
	}
} as const
export type ModelProviderID = typeof MODEL_PROVIDERS[keyof typeof MODEL_PROVIDERS]["id"]

export interface ModelProviderSettings {
	id: ModelProviderID,
	label: string,
	baseURL: string
}
