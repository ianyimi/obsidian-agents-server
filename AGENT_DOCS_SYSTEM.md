# Agent Documentation System - Implementation Status

## Overview

A self-documenting system where agents can learn from existing documentation and create new documentation to remember important patterns and discoveries.

## Current Status: PARTIAL IMPLEMENTATION

### ✅ Completed

1. **Settings Type Updated**
   - Added `agentDocsFolder?: string` to `ObsidianAgentsServerSettings` in `src/settings/types.ts`
   - Default value: `"Agent Docs"`

2. **Settings UI Added**
   - Added field to `src/settings/general/index.tsx`
   - Form field for "Agent Docs Folder" with description
   - Saves to plugin settings

3. **Documentation Created**
   - `Agent Docs/Vault/plugin-links.md` - Complete plugin directory with rankings, ref search queries, usage patterns
   - `Agent Docs/_meta/how-to-use.md` - Instructions for agents on using the docs system
   - `prompts/vault-architect-v2.md` - Updated prompt that references agent docs system

### 🚧 Incomplete

1. **Vault Tools for Agent Docs** - NOT IMPLEMENTED
   - `list_agent_docs` - List files in agent docs folder structure
   - `read_agent_doc` - Read doc from agent docs folder (with proper path resolution)
   - `create_agent_doc` - Create new doc in appropriate system folder
   - `update_agent_doc` - Update existing agent doc

2. **Search Functionality** - NEEDS FIXING
   - Current `fuzzy_search` tool doesn't work properly
   - `prepareFuzzySearch` requires proper usage (search function needs items array)
   - Alternative: Use direct content search or internal plugin APIs

3. **Agent Prompt Update** - NOT APPLIED
   - `prompts/vault-architect-v2.md` exists but not used in agent configuration
   - Need to update Vault Agent's instructions in `data.json` or via UI

## Folder Structure

```
Agent Docs/
├── Vault/
│   └── plugin-links.md          # ✅ Complete plugin directory
├── _meta/
│   └── how-to-use.md            # ✅ Agent instructions
├── Journals/                     # Future
├── Finance/                      # Future
├── Gym/                          # Future
└── [System]/                     # Future system folders
```

## Key Files

### Documentation Files

**`Agent Docs/Vault/plugin-links.md`**
- Ranks all 41 plugins by importance (⭐⭐⭐⭐⭐ to ⭐)
- Provides ref MCP search queries for each plugin
- Documents common patterns and use cases
- Shows typical system stacks (Metadata Menu + Templater + Datacore + Charts)

**`Agent Docs/_meta/how-to-use.md`**
- Complete guide for agents on reading and creating docs
- File naming conventions (kebab-case)
- When to document discoveries
- Example workflows

**`prompts/vault-architect-v2.md`**
- Self-documenting agent prompt
- Instructions to read agent docs before tasks
- How to create new docs when discoveries are made
- References plugin-links.md for plugin information

### Code Files

**`src/settings/types.ts`**
```typescript
export interface ObsidianAgentsServerSettings {
  // ... existing fields
  agentDocsFolder?: string  // ✅ Added
  agents: AgentSettings[]
}

export const DEFAULT_SETTINGS = {
  // ... existing defaults
  agentDocsFolder: "Agent Docs"  // ✅ Added
}
```

**`src/settings/general/index.tsx`**
```typescript
// Added to form defaultValues:
agentDocsFolder: plugin.settings.agentDocsFolder || "Agent Docs"

// Added to onSubmit:
plugin.settings.agentDocsFolder = value.agentDocsFolder

// Added to form fields:
<form.AppField
  name="agentDocsFolder"
  children={(field) =>
    <field.TextField
      label="Agent Docs Folder"
      description="Folder path in your vault where agents store system documentation"
    />
  }
/>
```

## Implementation Plan (When Resuming)

### Phase 1: Fix Search
```typescript
// Option A: Simple content search (recommended)
async function searchFiles(query: string, folderPath?: string) {
  const folder = folderPath
    ? app.vault.getAbstractFileByPath(folderPath)
    : null

  const files = folder
    ? getAllFilesInFolder(folder)
    : app.vault.getMarkdownFiles()

  const results = []
  for (const file of files) {
    const content = await app.vault.cachedRead(file)
    if (content.toLowerCase().includes(query.toLowerCase())) {
      results.push({ path: file.path, name: file.basename })
    }
  }
  return results
}
```

### Phase 2: Agent Docs Tools

**Add to `src/tools/vault.ts`:**

```typescript
export const VAULT_TOOLS = {
  // ... existing tools
  listAgentDocs: {
    id: "list_agent_docs",
    label: "List Agent Docs"
  },
  readAgentDoc: {
    id: "read_agent_doc",
    label: "Read Agent Doc"
  },
  createAgentDoc: {
    id: "create_agent_doc",
    label: "Create Agent Doc"
  },
  updateAgentDoc: {
    id: "update_agent_doc",
    label: "Update Agent Doc"
  },
}

// Implementation examples:

// list_agent_docs
vaultTool({
  id: VAULT_TOOLS.listAgentDocs.id,
  tool: tool({
    name: VAULT_TOOLS.listAgentDocs.id,
    description: "List all documentation files in the agent docs folder, organized by system",
    parameters: z.object({
      system: z.string().optional().describe("Filter to specific system folder (e.g., 'Vault', 'Finance')")
    }),
    async execute({ system }) {
      const docsFolder = plugin.settings.agentDocsFolder || "Agent Docs"
      const folder = plugin.app.vault.getAbstractFileByPath(docsFolder)

      if (!folder) {
        return { error: `Agent docs folder not found: ${docsFolder}` }
      }

      // Recursively get all .md files
      const docs = {}
      for (const child of folder.children) {
        if (child.children) { // Is a folder
          if (!system || child.name === system) {
            docs[child.name] = child.children
              .filter(f => f.extension === 'md')
              .map(f => ({ name: f.basename, path: f.path }))
          }
        }
      }

      return { docsFolder, systems: Object.keys(docs), docs }
    }
  })
})

// read_agent_doc
vaultTool({
  id: VAULT_TOOLS.readAgentDoc.id,
  tool: tool({
    name: VAULT_TOOLS.readAgentDoc.id,
    description: "Read a documentation file from the agent docs folder",
    parameters: z.object({
      system: z.string().describe("System folder (e.g., 'Vault', 'Finance')"),
      filename: z.string().describe("Document filename (e.g., 'plugin-links.md')")
    }),
    async execute({ system, filename }) {
      const docsFolder = plugin.settings.agentDocsFolder || "Agent Docs"
      const path = `${docsFolder}/${system}/${filename}`
      const file = plugin.app.vault.getFileByPath(path)

      if (!file) {
        return { error: `Doc not found: ${path}` }
      }

      const content = await plugin.app.vault.cachedRead(file)
      return { path, content }
    }
  })
})

// create_agent_doc
vaultTool({
  id: VAULT_TOOLS.createAgentDoc.id,
  tool: tool({
    name: VAULT_TOOLS.createAgentDoc.id,
    description: "Create a new documentation file in the agent docs folder",
    parameters: z.object({
      system: z.string().describe("System folder (e.g., 'Finance', 'Gym')"),
      filename: z.string().describe("Document filename (e.g., 'preferences.md')"),
      content: z.string().describe("Document content in markdown")
    }),
    async execute({ system, filename, content }) {
      const docsFolder = plugin.settings.agentDocsFolder || "Agent Docs"
      const path = `${docsFolder}/${system}/${filename}`

      // Ensure folder exists
      const folderPath = `${docsFolder}/${system}`
      const folder = plugin.app.vault.getAbstractFileByPath(folderPath)
      if (!folder) {
        await plugin.app.vault.createFolder(folderPath)
      }

      await plugin.app.vault.create(path, content)
      return { success: true, path }
    }
  })
})

// update_agent_doc
vaultTool({
  id: VAULT_TOOLS.updateAgentDoc.id,
  tool: tool({
    name: VAULT_TOOLS.updateAgentDoc.id,
    description: "Update an existing documentation file in the agent docs folder",
    parameters: z.object({
      system: z.string(),
      filename: z.string(),
      content: z.string()
    }),
    async execute({ system, filename, content }) {
      const docsFolder = plugin.settings.agentDocsFolder || "Agent Docs"
      const path = `${docsFolder}/${system}/${filename}`
      const file = plugin.app.vault.getFileByPath(path)

      if (!file) {
        return { error: `Doc not found: ${path}` }
      }

      await plugin.app.vault.modify(file, content)
      return { success: true, path }
    }
  })
})
```

### Phase 3: Update Agent Configuration

Update Vault Agent in `data.json` or via UI:
- Replace `instructions` field with content from `prompts/vault-architect-v2.md`
- Enable new agent docs tools in `vaultTools`
- Test workflow: agent reads docs → builds system → documents discoveries

## Use Cases

### Example 1: Agent Learns User Preferences
```
User: "Build a finance tracker"
Agent: Reads Agent Docs/Vault/plugin-links.md
Agent: Sees Templater ⭐⭐⭐⭐⭐, Datacore ⭐⭐⭐⭐⭐, Metadata Menu ⭐⭐⭐⭐⭐
Agent: Builds system using those plugins
Agent: Discovers user prefers YYYY-MM-DD date format
Agent: create_agent_doc(system="Finance", filename="preferences.md", content="...")
Agent: "I've documented your date preference in Agent Docs/Finance/preferences.md"
```

### Example 2: New Agent Learns from Docs
```
User: Creates new "Finance Assistant" agent
Finance Agent: Reads Agent Docs/Finance/ folder
Finance Agent: Learns about Transaction schema, date formats, spending categories
Finance Agent: Uses established patterns instead of asking user
```

### Example 3: System Evolution
```
Agent: Working on Finance system v2
Agent: Reads Agent Docs/Finance/system-overview.md
Agent: Sees v1 used individual transaction files
Agent: Proposes improvement using Datacore tables
Agent: Updates Agent Docs/Finance/system-overview.md with v2 architecture
```

## Benefits

1. **Institutional Memory**: Agents remember discoveries across sessions
2. **Consistency**: All agents follow documented patterns
3. **Reduced Questions**: Agents learn preferences from docs
4. **System Evolution**: Documentation evolves with systems
5. **New Agent Onboarding**: New agents learn from existing docs

## Notes

- User has YYYY-MM-DD.ddd.md format for daily notes (stored in general settings)
- Agent docs folder configurable per user
- Each system gets its own folder
- Agents should read docs BEFORE starting work
- Agents should document AFTER discovering patterns

## Next Steps When Resuming

1. Fix fuzzy search or implement simple content search
2. Implement the 4 agent docs tools (list, read, create, update)
3. Update Vault Agent prompt to vault-architect-v2.md
4. Enable new tools for Vault Agent
5. Test workflow: build a system, have agent document discoveries
6. Consider adding more vault tools from `prompts/additional-vault-tools.md`
