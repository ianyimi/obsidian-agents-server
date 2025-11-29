import { type Tool, tool } from "@openai/agents"
import { z } from "zod"
import ObsidianAgentsServer from ".."
import { ModifyFileOptionsSchema, AgentTool, SupportedPlugin, SUPPORTED_PLUGINS } from "./types"
import { templaterApi } from "./plugin-utils"

export const VAULT_TOOLS = {
	countNotes: {
		id: "count_notes",
		label: "Count Notes"
	},
	readFile: {
		id: "read_file",
		label: "Read File"
	},
	createFile: {
		id: "create_file",
		label: "Create File"
	},
	createFileFromTemplate: {
		id: "create_file_from_template",
		label: "Create File From Template"
	},
	updateFile: {
		id: "update_file",
		label: "Update File"
	},
	deleteFile: {
		id: "delete_file",
		label: "Delete File"
	},
} as const
export type VaultToolsID = typeof VAULT_TOOLS[keyof typeof VAULT_TOOLS]["id"]

function vaultTool({ id, plugins = [], tool }: { id: VaultToolsID, plugins?: SupportedPlugin[], tool: Tool }): AgentTool {
	return {
		id,
		type: { id: "vault", label: "Vault Tools" },
		plugins: plugins.map(p => p.id),
		tool
	}
}

export function createVaultTools(plugin: ObsidianAgentsServer) {
	return [

		// countNotes
		vaultTool({
			id: VAULT_TOOLS.countNotes.id,
			tool: tool({
				name: VAULT_TOOLS.countNotes.id,
				description: "Count all markdown files in the vault. Returns a number representing the total count of markdown files in the vault.",
				parameters: z.object({}),
				async execute() {
					const files = plugin.app.vault.getMarkdownFiles()
					console.log(`[get_files] Found ${files.length} markdown files`)
					return files.length
				}
			})
		}),

		// createFile
		vaultTool({
			id: VAULT_TOOLS.createFile.id,
			tool: tool({
				name: VAULT_TOOLS.createFile.id,
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
			id: VAULT_TOOLS.readFile.id,
			tool: tool({
				name: VAULT_TOOLS.readFile.id,
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
			id: VAULT_TOOLS.updateFile.id,
			tool: tool({
				name: VAULT_TOOLS.updateFile.id,
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
			id: VAULT_TOOLS.deleteFile.id,
			tool: tool({
				name: VAULT_TOOLS.deleteFile.id,
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
			id: VAULT_TOOLS.createFileFromTemplate.id,
			plugins: [SUPPORTED_PLUGINS.templater],
			tool: tool({
				name: VAULT_TOOLS.createFileFromTemplate.id,
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
