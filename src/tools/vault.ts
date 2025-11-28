import { tool } from "@openai/agents"
import { z } from "zod"
import ObsidianAgentsServer from ".."

export function createVaultTools(plugin: ObsidianAgentsServer) {
	return [
		tool({
			name: "get_file_by_path",
			description: "Get a file inside the vault at the given path. Returns null if the file does not exist.",
			parameters: z.object({
				path: z.string()
			}),
			async execute({ path }) {
				return plugin.app.vault.getFileByPath(path)
			}
		}),
	]
}
