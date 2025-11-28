import { type Tool, tool } from "@openai/agents"
import { z } from "zod"
import ObsidianAgentsServer from ".."
import { ModifyFileOptionsSchema, AgentTool, SupportedPlugin, SUPPORTED_PLUGINS } from "./types"
import { templaterApi } from "./plugin-utils"

export const VAULT_TOOLS = {
	getFiles: "get_files",
	readFile: "read_file",
	createFile: "create_file",
	createFileFromTemplate: "create_file_from_template",
	updateFile: "update_file",
	deleteFile: "delete_file",
} as const

function vaultTool({ plugins = [], tool }: { plugins?: SupportedPlugin[], tool: Tool }): AgentTool {
	return {
		type: { id: "", label: "" },
		plugins: plugins.map(p => p.id),
		tool
	}
}

export function createVaultTools(plugin: ObsidianAgentsServer) {
	return [

		// getFiles
		vaultTool({
			tool: tool({
				name: VAULT_TOOLS.getFiles,
				description: "Get all files in the vault",
				parameters: z.object({}),
				async execute() {
					return plugin.app.vault.getMarkdownFiles()
				}
			})
		}),

		// createFile
		vaultTool({
			tool: tool({
				name: VAULT_TOOLS.createFile,
				description: "Create a new plaintext file in the vault",
				parameters: z.object({
					path: z.string(),
					data: z.string(),
					options: ModifyFileOptionsSchema
				}),
				async execute({ path, data, options }) {
					const typedOptions = {
						mtime: options.mtime ?? undefined,
						ctime: options.ctime ?? undefined
					}
					return plugin.app.vault.create(path, data, typedOptions)
				}
			})
		}),

		// readFile
		vaultTool({
			tool: tool({
				name: VAULT_TOOLS.readFile,
				description: "Get a file inside the vault at the given path. Returns null if the file does not exist. Returns a TFile if it does. Set the cache param to true when reading the file only, without plans to update tha file in the near future",
				parameters: z.object({
					path: z.string(),
					cache: z.boolean().default(false)
				}),
				async execute({ path, cache }) {
					const file = plugin.app.vault.getFileByPath(path)
					if (!file) throw new Error(`File not found: ${path}`)
					if (cache) return await plugin.app.vault.cachedRead(file)
					return await plugin.app.vault.read(file)
				}
			})
		}),

		// updateFile
		vaultTool({
			tool: tool({
				name: VAULT_TOOLS.updateFile,
				description: "Modify the contents of a plaintext file",
				parameters: z.object({
					path: z.string(),
					data: z.string(),
					options: ModifyFileOptionsSchema
				}),
				async execute({ path, data, options }) {
					const file = plugin.app.vault.getFileByPath(path)
					if (!file) throw new Error(`File not found: ${path}`)
					const typedOptions = {
						mtime: options.mtime ?? undefined,
						ctime: options.ctime ?? undefined,
					}
					return await plugin.app.vault.modify(file, data, typedOptions)
				}
			})
		}),

		// deleteFile
		vaultTool({
			tool: tool({
				name: VAULT_TOOLS.deleteFile,
				description: "Deletes a file completely",
				parameters: z.object({
					path: z.string(),
					force: z.boolean().default(false)
				}),
				async execute({ path, force }) {
					const file = plugin.app.vault.getFileByPath(path)
					if (!file) throw new Error(`File not found: ${path}`)
					return await plugin.app.vault.delete(file, force)
				}
			})
		}),

		// createFileFromTemplate
		vaultTool({
			plugins: [SUPPORTED_PLUGINS.templater],
			tool: tool({
				name: VAULT_TOOLS.createFileFromTemplate,
				description: "Create a new plaintext file in the vault using a template from the templater plugin",
				parameters: z.object({
					newFilename: z.string(),
					targetFolderPath: z.string(),
					templateFilename: z.string()
				}),
				async execute({ newFilename, targetFolderPath, templateFilename }) {
					const { createFromTemplate, findTemplate } = templaterApi(plugin)
					const template = findTemplate(templateFilename)
					await createFromTemplate(
						template,
						newFilename,
						false,
						targetFolderPath
					)
				}
			})
		})

	]
}
