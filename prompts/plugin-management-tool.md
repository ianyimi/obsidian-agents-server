# Plugin Management Tool Specification

## update_plugin_settings

A powerful tool that allows agents to modify the plugin's data.json configuration and trigger a reload.

### Purpose
Enable agents to:
- Create new agents
- Modify existing agent configurations
- Update plugin settings
- Add/remove MCP tools from agents
- Self-improve by requesting and configuring new capabilities

### Function Signature

```typescript
{
  name: "update_plugin_settings",
  description: "Update the plugin's data.json configuration and reload the plugin to apply changes. Use this to create/modify agents, update settings, and configure MCP tools.",
  parameters: z.object({
    settings: z.object({
      // Full ObsidianAgentsServerSettings structure
      activeTab: z.string().optional(),
      deviceID: z.string().optional(),
      serverPort: z.number().optional(),
      controlDeviceID: z.string().optional(),
      modelProviders: z.array(z.any()).optional(),
      mcpServers: z.array(z.any()).optional(),
      customToolsFolder: z.string().optional(),
      agents: z.array(z.object({
        id: z.string(),
        name: z.string(),
        enabled: z.boolean(),
        useAsTool: z.boolean(),
        toolName: z.string(),
        toolDescription: z.string(),
        instructions: z.string(),
        collapsed: z.boolean(),
        modelProvider: z.string(),
        model: z.string(),
        agentTools: z.array(z.string()),
        vaultTools: z.record(z.boolean()),
        mcpTools: z.array(z.object({
          enabled: z.boolean(),
          type: z.object({ id: z.literal("mcp") }),
          serverID: z.string(),
          toolIDs: z.array(z.string())
        })),
        tools: z.array(z.any())
      }))
    }),
    reloadPlugin: z.boolean().default(true).describe("Whether to reload the plugin after saving settings")
  })
}
```

### Implementation

```typescript
// Add to vault.ts

vaultTool({
  id: VAULT_TOOLS.updatePluginSettings.id,
  tool: tool({
    name: VAULT_TOOLS.updatePluginSettings.id,
    description: "Update plugin settings (data.json) and optionally reload. Use to create/modify agents and plugin configuration.",
    parameters: z.object({
      settings: z.any(), // Full settings object
      reloadPlugin: z.boolean().default(true)
    }),
    async execute({ settings, reloadPlugin }) {
      // Validate settings structure
      if (!settings || typeof settings !== 'object') {
        throw new Error('Invalid settings object')
      }

      // Save settings
      plugin.settings = { ...plugin.settings, ...settings }
      await plugin.saveData(plugin.settings)

      // Reload if requested
      if (reloadPlugin) {
        // Close MCP connections
        await plugin.mcpManager.closeAll()

        // Reinitialize
        plugin.modelProviders = plugin.initializeModelProviders()
        plugin.tools = plugin.initializeTools()
        await plugin.mcpManager.initializeServers()
        plugin.agents = await plugin.initializeAgents()

        // Restart server
        await plugin.restartServer()

        return {
          success: true,
          message: 'Settings updated and plugin reloaded',
          agentCount: plugin.settings.agents.length
        }
      }

      return {
        success: true,
        message: 'Settings updated (reload required)',
      }
    }
  })
})
```

### Usage Examples

#### Example 1: Create a new agent

```typescript
// Agent reads current settings
const currentSettings = await read_file({
  path: '.obsidian/plugins/obsidian-agents-server/data.json'
})

const settings = JSON.parse(currentSettings)

// Add new agent
settings.agents.push({
  id: 'journal-assistant',
  name: 'Journal Assistant',
  enabled: true,
  useAsTool: false,
  toolName: 'journal_assistant',
  toolDescription: 'Helps with daily journaling and reflection',
  instructions: '...[prompt from prompts/journal-assistant.md]...',
  collapsed: false,
  modelProvider: 'lmstudio',
  model: 'qwen3-8b',
  agentTools: [],
  vaultTools: {
    count_notes: false,
    read_file: true,
    create_file: true,
    create_file_from_template: true,
    update_file: true,
    delete_file: false
  },
  mcpTools: [],
  tools: []
})

// Update settings and reload
await update_plugin_settings({
  settings,
  reloadPlugin: true
})
```

#### Example 2: Add MCP tools to existing agent

```typescript
const currentSettings = await read_file({
  path: '.obsidian/plugins/obsidian-agents-server/data.json'
})

const settings = JSON.parse(currentSettings)

// Find agent to modify
const vaultAgent = settings.agents.find(a => a.id === 'vault-architect')

// Add ref MCP tools
vaultAgent.mcpTools.push({
  enabled: true,
  type: { id: 'mcp' },
  serverID: 'ref',
  toolIDs: ['ref_search_documentation', 'ref_read_url']
})

await update_plugin_settings({
  settings,
  reloadPlugin: true
})
```

#### Example 3: Enable a vault tool for an agent

```typescript
const currentSettings = await read_file({
  path: '.obsidian/plugins/obsidian-agents-server/data.json'
})

const settings = JSON.parse(currentSettings)

// Enable list_files tool (after it's been implemented)
const agent = settings.agents.find(a => a.id === 'vault-architect')
agent.vaultTools.list_files = true

await update_plugin_settings({
  settings,
  reloadPlugin: true
})
```

### Safety Considerations

1. **Validation**: Always validate the settings structure before saving
2. **Backup**: Consider backing up data.json before modifications
3. **Error Handling**: Catch and report errors during reload
4. **Atomic Operations**: Ensure settings are either fully saved or not at all
5. **Server Restart**: Handle server restart gracefully (close connections first)

### Agent Workflow

When an agent uses this tool:

1. **Read current settings**: `read_file` on data.json
2. **Parse JSON**: Convert to object
3. **Modify as needed**: Add/update agents or settings
4. **Validate**: Ensure structure is correct
5. **Save and reload**: Call `update_plugin_settings`
6. **Verify**: Check that changes took effect

### Data.json Location

- Development: `.obsidian/plugins/obsidian-agents-server.git/dev/data.json`
- Production: `.obsidian/plugins/obsidian-agents-server/data.json`

Note: The agent should check both locations or be configured with the correct path.

### Alternative: Incremental Updates

For simpler use cases, consider these convenience wrappers:

```typescript
// create_agent - Just create a new agent
// update_agent - Update specific agent by ID
// enable_tool - Enable a vault tool for an agent
// add_mcp_tools - Add MCP tools to an agent
```

These would internally call `update_plugin_settings` but provide simpler interfaces.
