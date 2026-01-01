import { RunContext, type Tool, tool } from "@openai/agents"
import { z } from "zod"
import ObsidianAgentsServer from ".."
import { ModifyFileOptionsSchema, AgentTool, SupportedPlugin, SUPPORTED_PLUGINS, TOOL_TYPES } from "./types"
import { omnisearchApi, templaterApi } from "./plugin-utils"
import { AgentSettings, agentSettingsSchema } from "~/agents/types"
import { nanoid } from "nanoid"

export const VAULT_TOOLS = {
  countNotes: {
    id: "count_notes",
    label: "Count Notes"
  },
  createFile: {
    id: "create_file",
    label: "Create File"
  },
  readFile: {
    id: "read_file",
    label: "Read File"
  },
  updateFile: {
    id: "update_file",
    label: "Update File"
  },
  deleteFile: {
    id: "delete_file",
    label: "Delete File"
  },
  createFileFromTemplate: {
    id: "create_file_from_template",
    label: "Create File From Template"
  },

  omniSearch: {
    id: "omni_search",
    label: "Search Files"
  },

  createAgent: {
    id: "create_agent",
    label: "Create Agent"
  },
  getAgentsSettings: {
    id: "get_agents_settings",
    label: "Get Agents Settings"
  },
  updateAgentsSettings: {
    id: "update_agents_settings",
    label: "Update Agents Settings"
  },
  restartAgentsServer: {
    id: "restart_agents_server",
    label: "Restart Server"
  }
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

type AgentRunContext = RunContext<{ agentSettings: AgentSettings }>
function checkIncludedExcludedPaths({ path, context }: { path: string, context: AgentRunContext }) {
  if (context.context.agentSettings.includedFolders.length > 0) {
    if (!context.context.agentSettings.includedFolders.some((inf) => path.includes(inf.path))) {
      throw new Error("Unauthorized to Access Files on this path")
    }
  }
  if (context.context.agentSettings.excludedFolders.length > 0) {
    if (context.context.agentSettings.excludedFolders.some((exf) => path.includes(exf.path))) {
      throw new Error("Unauthorized to Access Files on this path")
    }
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
          return String(files.length)
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
        async execute({ path, data, options }, context) {
          checkIncludedExcludedPaths({ path, context: context as AgentRunContext })
          const typedOptions = {
            mtime: options.mtime ?? undefined,
            ctime: options.ctime ?? undefined
          }
          return await plugin.app.vault.create(path, data, typedOptions)
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
        async execute({ path, cache }, context) {
          checkIncludedExcludedPaths({ path, context: context as AgentRunContext })
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
        async execute({ path, data, options }, context) {
          checkIncludedExcludedPaths({ path, context: context as AgentRunContext })
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
        async execute({ path, force }, context) {
          checkIncludedExcludedPaths({ path, context: context as AgentRunContext })
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
        async execute({ newFilename, targetFolderPath, templateFilename }, context) {
          checkIncludedExcludedPaths({ path: targetFolderPath, context: context as AgentRunContext })
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
    }),

    // omniSearch
    vaultTool({
      id: VAULT_TOOLS.omniSearch.id,
      plugins: [SUPPORTED_PLUGINS.omnisearch],
      tool: tool({
        name: VAULT_TOOLS.omniSearch.id,
        description: "Search vault content for files that contain the search query",
        parameters: z.object({
          query: z.string(),
          limit: z.number().default(20)
        }),
        async execute({ query, limit }) {
          const omnisearch = omnisearchApi(plugin)
          const results = await omnisearch.search(query)
          const limitedResults = results.slice(0, limit)
          console.log('limited searchRes: ', limit, limitedResults)
          return JSON.stringify({
            total: results.length,
            files: limitedResults
          })
        }
      })
    }),

    // getAgentsSettings
    vaultTool({
      id: VAULT_TOOLS.getAgentsSettings.id,
      tool: tool({
        name: VAULT_TOOLS.getAgentsSettings.id,
        description: "Get settings for all agents",
        parameters: z.object({}),
        async execute() {
          return plugin.settings.agents
        }
      })
    }),

    // updateAgentsSettings
    vaultTool({
      id: VAULT_TOOLS.updateAgentsSettings.id,
      tool: tool({
        name: VAULT_TOOLS.updateAgentsSettings.id,
        description: "Update the settings for a specific agent",
        parameters: z.object({
          agentID: z.string(),
          data: agentSettingsSchema
        }),
        async execute({ agentID, data }) {
          plugin.settings.agents = plugin.settings.agents.map(agent => {
            if (agent.id !== agentID) return agent;
            const mcpTools = data.mcpTools.map(mcp => ({
              ...mcp,
              toolsID: Object.values(TOOL_TYPES).filter(t => mcp.toolsID.includes(t.id)!)
            }))
            return { id: agentID, ...data, mcpTools } as unknown as AgentSettings
          })
          await plugin.saveSettings()
          await plugin.restartServer()
        }
      })
    }),

    // createAgent
    vaultTool({
      id: VAULT_TOOLS.createAgent.id,
      tool: tool({
        name: VAULT_TOOLS.createAgent.id,
        description: "Create a new Agent in the plugin settings",
        parameters: z.object({
          data: agentSettingsSchema
        }),
        async execute({ data }) {
          const mcpTools = data.mcpTools.map(mcp => ({
            ...mcp,
            toolsID: Object.values(TOOL_TYPES).filter(t => mcp.toolsID.includes(t.id)!)
          }))
          const newAgent = { id: nanoid(), ...data, mcpTools } as unknown as AgentSettings
          plugin.settings.agents.push(newAgent)
          await plugin.saveSettings()
          await plugin.restartServer()
        }
      })
    }),

    // restartAgentsServer
    vaultTool({
      id: VAULT_TOOLS.restartAgentsServer.id,
      tool: tool({
        name: VAULT_TOOLS.restartAgentsServer.id,
        description: "Create a new Agent in the plugin settings",
        parameters: z.object({}),
        async execute() {
          await plugin.restartServer()
        }
      })
    })
  ]
}
