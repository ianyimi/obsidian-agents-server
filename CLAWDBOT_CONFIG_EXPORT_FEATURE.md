# Clawdbot Config Export Feature

This document specifies a new feature for obsidian-agents-server that exports a clawdbot-compatible configuration file, enabling seamless integration between this plugin and clawdbot.

---

## Overview

The plugin will provide the ability to export clawdbot configuration in two modes:

1. **Provider Only** - Exports just the `models.providers.obsidian` section for merging into an existing clawdbot config
2. **Full Config** - Exports a complete `clawdbot.json` file ready to use

---

## Feature Specification

### Export Modes

#### Mode 1: Provider Config (Default)

Outputs only the model provider configuration that can be merged into an existing `clawdbot.json`:

```json5
{
  "models": {
    "providers": {
      "obsidian": {
        "baseUrl": "http://localhost:2345/v1",
        "api": "openai-completions",
        "models": [
          {
            "id": "vault-agent",
            "name": "Vault Agent",
            "contextWindow": 128000,
            "maxTokens": 8192
          },
          {
            "id": "research-agent",
            "name": "Research Agent",
            "contextWindow": 128000,
            "maxTokens": 8192
          }
        ]
      }
    }
  }
}
```

#### Mode 2: Full Config

Outputs a complete clawdbot configuration file:

```json5
{
  "models": {
    "providers": {
      "obsidian": {
        "baseUrl": "http://localhost:2345/v1",
        "api": "openai-completions",
        "models": [
          {
            "id": "vault-agent",
            "name": "Vault Agent",
            "contextWindow": 128000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "obsidian/vault-agent"
      },
      "workspace": "~/clawd",
      "memorySearch": {
        "enabled": true,
        "provider": "local"
      },
      "compaction": {
        "reserveTokensFloor": 20000,
        "memoryFlush": {
          "enabled": true,
          "softThresholdTokens": 4000
        }
      }
    },
    "list": [
      {
        "id": "vault-agent",
        "name": "Vault Agent",
        "model": "obsidian/vault-agent",
        "workspace": "~/clawd-vault"
      },
      {
        "id": "research-agent",
        "name": "Research Agent",
        "model": "obsidian/research-agent",
        "workspace": "~/clawd-research"
      }
    ]
  }
}
```

---

## Implementation

### New Settings

Add to `ObsidianAgentsServerSettings`:

```typescript
interface ObsidianAgentsServerSettings {
  // ... existing settings ...

  // Clawdbot export settings
  clawdbotExport?: {
    // Default agent to use in clawdbot
    defaultAgentId?: string;
    // Base workspace path for clawdbot agents
    workspaceBasePath?: string;
    // Context window to report (from LMStudio model)
    defaultContextWindow?: number;
    // Max tokens to report
    defaultMaxTokens?: number;
  }
}
```

### API Endpoint

Add a new endpoint to export the config:

```typescript
// GET /v1/clawdbot/config?mode=provider|full
app.get("/v1/clawdbot/config", async (c) => {
  const mode = c.req.query("mode") || "provider";
  const config = this.generateClawdbotConfig(mode);
  return c.json(config);
})
```

### Core Export Function

```typescript
interface ClawdbotModelConfig {
  id: string;
  name: string;
  contextWindow: number;
  maxTokens: number;
}

interface ClawdbotProviderConfig {
  models: {
    providers: {
      obsidian: {
        baseUrl: string;
        api: "openai-completions";
        models: ClawdbotModelConfig[];
      }
    }
  }
}

interface ClawdbotFullConfig extends ClawdbotProviderConfig {
  agents: {
    defaults: {
      model: { primary: string };
      workspace: string;
      memorySearch: { enabled: boolean; provider: string };
      compaction: {
        reserveTokensFloor: number;
        memoryFlush: { enabled: boolean; softThresholdTokens: number };
      };
    };
    list: Array<{
      id: string;
      name: string;
      model: string;
      workspace: string;
    }>;
  };
}

generateClawdbotConfig(mode: "provider" | "full"): ClawdbotProviderConfig | ClawdbotFullConfig {
  const enabledAgents = this.settings.agents.filter(a => a.enabled);
  const exportSettings = this.settings.clawdbotExport || {};

  // Build model list from enabled agents
  const models: ClawdbotModelConfig[] = enabledAgents.map(agent => {
    // Try to get context window from the agent's model provider
    const modelProvider = this.modelProviders.find(mp => mp.id === agent.modelProvider);
    let contextWindow = exportSettings.defaultContextWindow || 128000;

    if (modelProvider?.id === "lmstudio") {
      // Attempt to get actual context limit
      const limit = modelProvider.getModelContextLimit?.(agent.model);
      if (limit) contextWindow = limit;
    }

    return {
      id: agent.name.toLowerCase().replace(/\s+/g, "-"),
      name: agent.name,
      contextWindow,
      maxTokens: exportSettings.defaultMaxTokens || 8192
    };
  });

  // Provider-only config
  const providerConfig: ClawdbotProviderConfig = {
    models: {
      providers: {
        obsidian: {
          baseUrl: `http://localhost:${this.settings.serverPort}/v1`,
          api: "openai-completions",
          models
        }
      }
    }
  };

  if (mode === "provider") {
    return providerConfig;
  }

  // Full config
  const defaultAgent = exportSettings.defaultAgentId
    ? enabledAgents.find(a => a.id === exportSettings.defaultAgentId)
    : enabledAgents[0];

  const defaultModelId = defaultAgent
    ? defaultAgent.name.toLowerCase().replace(/\s+/g, "-")
    : models[0]?.id;

  const workspaceBase = exportSettings.workspaceBasePath || "~/clawd";

  const fullConfig: ClawdbotFullConfig = {
    ...providerConfig,
    agents: {
      defaults: {
        model: { primary: `obsidian/${defaultModelId}` },
        workspace: workspaceBase,
        memorySearch: {
          enabled: true,
          provider: "local"
        },
        compaction: {
          reserveTokensFloor: 20000,
          memoryFlush: {
            enabled: true,
            softThresholdTokens: 4000
          }
        }
      },
      list: enabledAgents.map(agent => {
        const modelId = agent.name.toLowerCase().replace(/\s+/g, "-");
        return {
          id: modelId,
          name: agent.name,
          model: `obsidian/${modelId}`,
          workspace: `${workspaceBase}-${modelId}`
        };
      })
    }
  };

  return fullConfig;
}
```

---

## UI Integration

### Settings Tab

Add a new section to the settings UI:

```tsx
// In settings/clawdbot/index.tsx

export function ClawdbotExportSettings({ plugin }: { plugin: ObsidianAgentsServer }) {
  const [exportMode, setExportMode] = useState<"provider" | "full">("provider");
  const [copied, setCopied] = useState(false);

  const config = useMemo(() => {
    return plugin.generateClawdbotConfig(exportMode);
  }, [exportMode, plugin.settings.agents]);

  const configString = JSON.stringify(config, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(configString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([configString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportMode === "full" ? "clawdbot.json" : "clawdbot-provider.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="clawdbot-export-settings">
      <h3>Clawdbot Config Export</h3>
      <p>Export your agent configuration for use with clawdbot.</p>

      <div className="export-mode-selector">
        <label>
          <input
            type="radio"
            value="provider"
            checked={exportMode === "provider"}
            onChange={() => setExportMode("provider")}
          />
          Provider Only (merge into existing config)
        </label>
        <label>
          <input
            type="radio"
            value="full"
            checked={exportMode === "full"}
            onChange={() => setExportMode("full")}
          />
          Full Config (complete clawdbot.json)
        </label>
      </div>

      <div className="config-preview">
        <pre>{configString}</pre>
      </div>

      <div className="export-actions">
        <button onClick={handleCopy}>
          {copied ? "Copied!" : "Copy to Clipboard"}
        </button>
        <button onClick={handleDownload}>
          Download {exportMode === "full" ? "clawdbot.json" : "clawdbot-provider.json"}
        </button>
      </div>

      <div className="export-instructions">
        <h4>Usage Instructions</h4>
        {exportMode === "provider" ? (
          <ol>
            <li>Copy or download the config above</li>
            <li>Open your existing <code>~/.clawdbot/clawdbot.json</code></li>
            <li>Merge the <code>models.providers.obsidian</code> section</li>
            <li>Set an agent's model to <code>obsidian/agent-name</code></li>
            <li>Restart the clawdbot gateway</li>
          </ol>
        ) : (
          <ol>
            <li>Download the config file</li>
            <li>Move to <code>~/.clawdbot/clawdbot.json</code></li>
            <li>Ensure this Obsidian plugin is running</li>
            <li>Start the clawdbot gateway</li>
          </ol>
        )}
      </div>
    </div>
  );
}
```

### Command Palette

Register an Obsidian command:

```typescript
// In index.ts onload()

this.addCommand({
  id: "export-clawdbot-config",
  name: "Export Clawdbot Config",
  callback: () => {
    const config = this.generateClawdbotConfig("full");
    const configString = JSON.stringify(config, null, 2);

    // Open a modal with the config
    new ClawdbotExportModal(this.app, configString).open();
  }
});

this.addCommand({
  id: "copy-clawdbot-provider-config",
  name: "Copy Clawdbot Provider Config to Clipboard",
  callback: async () => {
    const config = this.generateClawdbotConfig("provider");
    const configString = JSON.stringify(config, null, 2);
    await navigator.clipboard.writeText(configString);
    new Notice("Clawdbot provider config copied to clipboard!");
  }
});
```

---

## Agent Tool for Self-Export

Add a vault tool that allows agents to export their own config:

```typescript
// In tools/vault.ts

vaultTool({
  id: VAULT_TOOLS.exportClawdbotConfig.id,
  tool: tool({
    name: "export_clawdbot_config",
    description: "Export the current agent configuration as a clawdbot-compatible config file",
    parameters: z.object({
      mode: z.enum(["provider", "full"]).default("provider"),
      outputPath: z.string().optional().describe("Optional vault path to save the config file")
    }),
    async execute({ mode, outputPath }) {
      const config = plugin.generateClawdbotConfig(mode);
      const configString = JSON.stringify(config, null, 2);

      if (outputPath) {
        await plugin.app.vault.create(outputPath, configString);
        return `Clawdbot config exported to ${outputPath}`;
      }

      return configString;
    }
  })
})
```

---

## Dynamic Agent ID Mapping

Since your agents use `name` for the OpenAI-compatible API but clawdbot needs stable IDs, the export maintains a mapping:

| Your Server | Clawdbot Config |
|-------------|-----------------|
| `model: "Vault Agent"` | `model: "obsidian/vault-agent"` |
| `model: "Research Agent"` | `model: "obsidian/research-agent"` |

The conversion:
- Lowercase the agent name
- Replace spaces with hyphens
- Prefix with `obsidian/` for the clawdbot model reference

---

## Example Output

Given these agents in your plugin:

```typescript
agents: [
  {
    id: "abc123",
    name: "Vault Agent",
    enabled: true,
    model: "qwen2.5-coder-32b",
    modelProvider: "lmstudio",
    // ...
  },
  {
    id: "def456",
    name: "Research Agent",
    enabled: true,
    model: "qwen2.5-coder-32b",
    modelProvider: "lmstudio",
    // ...
  },
  {
    id: "ghi789",
    name: "Disabled Agent",
    enabled: false,  // Not exported
    // ...
  }
]
```

**Provider Export:**

```json
{
  "models": {
    "providers": {
      "obsidian": {
        "baseUrl": "http://localhost:2345/v1",
        "api": "openai-completions",
        "models": [
          {
            "id": "vault-agent",
            "name": "Vault Agent",
            "contextWindow": 128000,
            "maxTokens": 8192
          },
          {
            "id": "research-agent",
            "name": "Research Agent",
            "contextWindow": 128000,
            "maxTokens": 8192
          }
        ]
      }
    }
  }
}
```

**Full Export:**

```json
{
  "models": {
    "providers": {
      "obsidian": {
        "baseUrl": "http://localhost:2345/v1",
        "api": "openai-completions",
        "models": [
          {
            "id": "vault-agent",
            "name": "Vault Agent",
            "contextWindow": 128000,
            "maxTokens": 8192
          },
          {
            "id": "research-agent",
            "name": "Research Agent",
            "contextWindow": 128000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "obsidian/vault-agent"
      },
      "workspace": "~/clawd",
      "memorySearch": {
        "enabled": true,
        "provider": "local"
      },
      "compaction": {
        "reserveTokensFloor": 20000,
        "memoryFlush": {
          "enabled": true,
          "softThresholdTokens": 4000
        }
      }
    },
    "list": [
      {
        "id": "vault-agent",
        "name": "Vault Agent",
        "model": "obsidian/vault-agent",
        "workspace": "~/clawd-vault-agent"
      },
      {
        "id": "research-agent",
        "name": "Research Agent",
        "model": "obsidian/research-agent",
        "workspace": "~/clawd-research-agent"
      }
    ]
  }
}
```

---

## Implementation Checklist

- [ ] Add `clawdbotExport` settings to `ObsidianAgentsServerSettings`
- [ ] Implement `generateClawdbotConfig()` method on plugin class
- [ ] Add `/v1/clawdbot/config` API endpoint
- [ ] Create settings UI component for export
- [ ] Register Obsidian commands for quick export
- [ ] Add `export_clawdbot_config` vault tool (optional)
- [ ] Add default settings values to `DEFAULT_SETTINGS`
- [ ] Write tests for config generation
- [ ] Update documentation

---

## Future Enhancements

1. **Live Sync** - Watch for agent changes and auto-update a linked clawdbot config file
2. **Import** - Parse an existing clawdbot config and suggest agent configurations
3. **Validation** - Check that the exported config is valid before saving
4. **Channel Templates** - Include optional channel configurations (iMessage, WhatsApp) in full export
5. **Binding Suggestions** - Generate recommended bindings based on agent purposes
