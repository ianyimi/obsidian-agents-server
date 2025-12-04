# Context Optimization Guide - Complete Implementation

## Problem Statement

Current context usage: **117,367 tokens** → causing LM Studio to truncate 116,180 tokens from middle
Target context usage: **<50,000 tokens** for safe operation

## Root Causes

1. Verbose agent prompts (~1100 tokens)
2. Documentation embedded in prompts (2000+ tokens)
3. Full file contents in tool outputs (10k+ tokens each)
4. Unlimited conversation history accumulation
5. No visibility into token usage

## Implementation Plan

All strategies maintain tool awareness - agents know what tools they have, use them only when needed.

---

## Phase 1: Minimize Agent Prompts (IMMEDIATE - 1 hour)

### Impact: Save ~800 tokens per message = 80k+ tokens over conversation

### Current State
```
prompts/vault-architect-v2.md: ~1100 tokens
- Full plugin knowledge repeated
- Detailed examples
- Extensive guidelines
```

### Solution: Reference, Don't Repeat

**Create: `prompts/vault-architect-minimal.md`**
```markdown
# Vault Architect Agent

Build Obsidian vault systems using optimal plugin combinations.

## Knowledge Sources

**Plugin Information** (read when needed):
- `Agent Docs/Vault/plugin-links.md` - Plugin rankings, patterns, ref queries

**System Documentation** (read before working):
- `Agent Docs/[System]/` - System-specific docs and preferences

**Current Plugins**:
- `.obsidian/community-plugins.json` - List of enabled plugins

## Available Tools

**Vault Operations**
- `count_notes` - Count markdown files
- `read_file(path, cache, pruneFor?)` - Read file contents
  - Set `cache=true` for read-only
  - Use `pruneFor` for large files: describe what you need
- `create_file(path, data, options)` - Create new file
- `create_file_from_template(newFilename, targetFolderPath, templateFilename)` - Use Templater
- `update_file(path, data, options)` - Modify existing file

**Documentation Research** (use sparingly)
- `ref_search_documentation(query)` - Search plugin docs (one search, then read results)
- `ref_read_url(url)` - Read specific doc URL from search results

## Core Principles

1. **Datacore over Dataview** - Always use Datacore for queries (better performance)
2. **Read docs first** - Check Agent Docs before assuming
3. **Use pruneFor** - When reading large files, specify what you need
4. **Tool awareness** - You have these tools, use only when necessary

## Standard Pattern

Every system uses:
- **Metadata Menu** for data schemas (fileClass)
- **Templater** for dynamic templates
- **Datacore** for queries and aggregation
- **Charts** for visualization (when needed)

## Workflow

1. **Before starting**: Read `Agent Docs/[System]/` if working on existing system
2. **Check plugins**: Read `plugin-links.md` if unsure which plugin to use
3. **Design system**: Schema → Templates → Queries → Dashboards
4. **Build incrementally**: One component at a time
5. **Document discoveries**: Create/update docs in `Agent Docs/[System]/`

## Guidelines

- **Minimal file reads**: Use `pruneFor` parameter for large files
- **Consistent naming**: kebab-case for files, PascalCase for fileClass
- **Read before write**: Always check existing files first
- **Progressive enhancement**: Start simple, add complexity only if needed
- **Document important patterns**: Help future you remember preferences

## Example Tool Usage

```typescript
// Reading large doc - specify what you need
read_file({
  path: "Agent Docs/Vault/plugin-links.md",
  pruneFor: "What are the top 3 plugins for building a finance tracker?"
})

// Reading small file - no pruning needed
read_file({
  path: "Finance/preferences.md",
  cache: true
})

// Creating with template
create_file_from_template({
  newFilename: "2025-12-03-workout",
  targetFolderPath: "Gym/Workouts",
  templateFilename: "workout-template"
})
```

Keep responses focused. Use tools judiciously. Read docs before guessing.
```

**Token Count**: ~450 tokens (vs 1100) = **650 token savings per message**

### Update Agent Configuration

```json
{
  "id": "XkR5PWYPI7mRi8Fq5LARR",
  "name": "Vault Agent",
  "instructions": "[Contents of vault-architect-minimal.md]",
  // ... rest of config stays same
}
```

---

## Phase 2: Lazy Load Documentation (HIGH IMPACT - 2 hours)

### Impact: Save 2000+ tokens by loading docs on-demand

### Current State
Agent prompts include full documentation inline

### Solution: Reference Docs, Load When Needed

**Agent prompts reference docs but don't include them:**
```markdown
## Knowledge Sources
- `Agent Docs/Vault/plugin-links.md` - Plugin info (READ WHEN NEEDED)
```

**Agents read docs only when working on relevant tasks:**
```typescript
// Agent working on finance system
read_file({
  path: "Agent Docs/Vault/plugin-links.md",
  pruneFor: "Which plugins are best for finance tracking?"
})
// Only loads doc when needed, not in every message
```

### Agent Behavior Training

Update all agent prompts to include:
```markdown
## Documentation Usage

**When to read docs:**
- Working on a system → Read `Agent Docs/[System]/`
- Unsure about plugin → Read `Agent Docs/Vault/plugin-links.md`
- Need syntax help → Use `ref_search_documentation`

**When NOT to read docs:**
- You're confident about the approach
- Working with basic vault operations
- Info is in recent conversation history
```

---

## Phase 3: Prune Tool Outputs (MEDIUM IMPACT - 3 hours)

### Impact: Save 10k+ tokens by returning summaries instead of full content

### Option A: Add pruneFor Parameter (Recommended)

Already exists in read_file, expand to other tools:

```typescript
// src/tools/vault.ts

// read_file - ALREADY HAS pruneFor
vaultTool({
  id: VAULT_TOOLS.readFile.id,
  tool: tool({
    name: VAULT_TOOLS.readFile.id,
    description: "Read file contents. Use pruneFor parameter for large files to get only relevant excerpts.",
    parameters: z.object({
      path: z.string(),
      cache: z.boolean().default(false),
      pruneFor: z.string().optional().describe(
        "For large files: describe what specific information you need. Returns only relevant content."
      )
    }),
    async execute({ path, cache, pruneFor }) {
      const file = plugin.app.vault.getFileByPath(path)
      if (!file) throw new Error(`File not found: ${path}`)

      let content = cache
        ? await plugin.app.vault.cachedRead(file)
        : await plugin.app.vault.read(file)

      // If pruning requested and content is large
      if (pruneFor && content.length > 1000) {
        // Simple excerpt-based pruning (before implementing full pruning agent)
        const lines = content.split('\n')
        const relevantLines = lines.filter(line =>
          line.toLowerCase().includes(pruneFor.toLowerCase()) ||
          lines.indexOf(line) < 5 // Keep first 5 lines (headers)
        )

        content = relevantLines.join('\n')

        return {
          path,
          content,
          pruned: true,
          originalLength: content.length,
          prunedLength: content.length
        }
      }

      return { path, content }
    }
  })
})

// NEW: Add list_files tool with pruning
vaultTool({
  id: "list_files",
  tool: tool({
    name: "list_files",
    description: "List markdown files in vault or specific folder",
    parameters: z.object({
      folder: z.string().optional().describe("Folder path to search in"),
      pattern: z.string().optional().describe("Filter pattern (e.g., '2025-12-*')"),
      limit: z.number().default(50).describe("Max files to return (default 50)")
    }),
    async execute({ folder, pattern, limit }) {
      let files = plugin.app.vault.getMarkdownFiles()

      if (folder) {
        files = files.filter(f => f.path.startsWith(folder))
      }

      if (pattern) {
        const regex = new RegExp(pattern.replace('*', '.*'))
        files = files.filter(f => regex.test(f.path))
      }

      // Limit results to prevent huge responses
      files = files.slice(0, limit)

      return {
        count: files.length,
        files: files.map(f => ({
          path: f.path,
          name: f.basename,
          folder: f.parent?.path || ''
        }))
      }
    }
  })
})

// NEW: Add search_vault tool with pruning
vaultTool({
  id: "search_vault",
  tool: tool({
    name: "search_vault",
    description: "Search vault content. Returns matches with context.",
    parameters: z.object({
      query: z.string(),
      folder: z.string().optional(),
      limit: z.number().default(10)
    }),
    async execute({ query, folder, limit }) {
      let files = plugin.app.vault.getMarkdownFiles()

      if (folder) {
        files = files.filter(f => f.path.startsWith(folder))
      }

      const matches = []

      for (const file of files) {
        if (matches.length >= limit) break

        const content = await plugin.app.vault.cachedRead(file)
        const lines = content.split('\n')

        const matchingLines = lines
          .map((line, idx) => ({ line, lineNum: idx + 1 }))
          .filter(({ line }) => line.toLowerCase().includes(query.toLowerCase()))

        if (matchingLines.length > 0) {
          matches.push({
            path: file.path,
            matches: matchingLines.slice(0, 3).map(m => ({
              line: m.lineNum,
              text: m.line.substring(0, 100) // Truncate long lines
            }))
          })
        }
      }

      return {
        query,
        resultCount: matches.length,
        matches
      }
    }
  })
})
```

### Update Agent Prompts to Use New Tools

```markdown
## Available Tools

**Vault Operations**
- `count_notes` - Count markdown files
- `read_file(path, cache, pruneFor?)` - Read file
  - Use `pruneFor` for large files: "what date format is used?"
- `create_file(path, data, options)` - Create file
- `update_file(path, data, options)` - Modify file
- `list_files(folder?, pattern?, limit=50)` - List files (auto-limited to 50)
- `search_vault(query, folder?, limit=10)` - Search content (auto-limited to 10)

**Tool Usage Guidelines**
- Use `pruneFor` when reading docs or large files
- Use `limit` parameters to avoid huge responses
- Read only what you need, when you need it
```

---

## Phase 4: Sliding Context Window (AUTOMATIC - 2 hours)

### Impact: Caps conversation history growth

### Implementation in Server

```typescript
// src/index.ts - in /v1/chat/completions endpoint

app.post("/v1/chat/completions", async (c) => {
  try {
    const body = await c.req.json() as CreateChatCompletionBody
    const { model, messages, stream = false } = body

    // NEW: Sliding window - keep recent messages only
    const MAX_MESSAGES = 30 // Configurable
    let trimmedMessages = messages

    if (messages.length > MAX_MESSAGES) {
      // Keep system message + recent messages
      const systemMsg = messages.find(m => m.role === 'system' || m.role === 'developer')
      const recentMsgs = messages.slice(-MAX_MESSAGES)

      trimmedMessages = systemMsg
        ? [systemMsg, ...recentMsgs.filter(m => m.role !== 'system' && m.role !== 'developer')]
        : recentMsgs

      console.log(`[Context] Trimmed ${messages.length} → ${trimmedMessages.length} messages`)
    }

    const agent = Object.values(this.agents).find(a => a.name === model)
    if (!agent) {
      return c.json({
        error: {
          message: `Model '${model}' not found. Available models: ${Object.values(this.agents).map(a => a.name).join(', ')}`,
          type: "invalid_request_error"
        }
      }, 404)
    }

    const agentMessages = convertMessagesToAgentInput(trimmedMessages);

    // ... rest of handler
  } catch (err: any) {
    // ... error handling
  }
})
```

### Make Configurable (Optional)

Add to settings:
```typescript
// src/settings/types.ts
export interface ObsidianAgentsServerSettings {
  // ... existing fields
  maxContextMessages?: number // Default 30
}

// src/settings/general/index.tsx
<form.AppField
  name="maxContextMessages"
  children={(field) =>
    <field.TextField
      label="Max Context Messages"
      description="Maximum conversation history to keep (default: 30)"
      inputProps={{
        type: "number",
        onChange: (e) => field.handleChange(Number(e.target.value))
      }}
    />
  }
/>
```

---

## Phase 5: Token Usage Tracking (MONITORING - 1 hour)

### Impact: Visibility into context usage

### Add Token Estimation Utility

```typescript
// src/lib/context.ts

export class ContextTracker {
  /**
   * Estimate tokens in text (rough: 1 token ≈ 4 chars)
   */
  static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  /**
   * Estimate tokens in message array
   */
  static estimateMessages(messages: any[]): number {
    return messages.reduce((sum, msg) => {
      const content = typeof msg.content === 'string'
        ? msg.content
        : JSON.stringify(msg.content)
      return sum + this.estimateTokens(content) + 4 // +4 for message overhead
    }, 0)
  }

  /**
   * Log context usage
   */
  static logUsage(messages: any[], agentName: string) {
    const tokens = this.estimateMessages(messages)
    const percent = Math.round((tokens / 128000) * 100)

    console.log(`[Context] ${agentName}:`, {
      messages: messages.length,
      estimatedTokens: tokens,
      contextUsage: `${percent}%`
    })

    if (tokens > 100000) {
      console.warn(`⚠️ [Context] Approaching limit! ${tokens}/128000 tokens (${percent}%)`)
    }

    return { tokens, percent }
  }
}
```

### Integrate in Server

```typescript
// src/index.ts
import { ContextTracker } from "~/lib/context"

app.post("/v1/chat/completions", async (c) => {
  try {
    const body = await c.req.json() as CreateChatCompletionBody
    const { model, messages, stream = false } = body

    // Log context usage
    ContextTracker.logUsage(messages, model)

    // ... rest of handler
  } catch (err: any) {
    // ... error handling
  }
})
```

### Expected Console Output

```
[Context] Vault Agent: { messages: 15, estimatedTokens: 45230, contextUsage: "35%" }
```

Or warning:
```
⚠️ [Context] Approaching limit! 105000/128000 tokens (82%)
```

---

## Phase 6: Pruning Agent (ADVANCED - 4 hours)

See `PRUNING_AGENT_PATTERN.md` for full implementation.

**Summary**: Optional agent that prunes verbose tool outputs based on what's needed.

Only implement after Phase 1-5 if still hitting limits.

---

## Updated Agent Prompts

### Orchestrator Agent

```markdown
# Orchestrator Agent

Coordinate between specialized agents and tools for vault management.

## Available Agents

- **Vault Agent** - System building, vault organization
- (Others as configured)

## Available Tools

**Vault Operations**
- `count_notes` - Count markdown files
- `read_file(path, cache, pruneFor?)` - Read files (use pruneFor for large files)

## Delegation Guidelines

- Use Vault Agent for system building, vault questions
- Call tools directly only for simple operations
- Keep responses concise

## Context Awareness

- You see full conversation history
- Specialized agents may have reduced context
- Provide clear, specific instructions when delegating
```

**Token Count**: ~200 tokens (vs 800+)

### Vault Agent

Already created above as `vault-architect-minimal.md` (~450 tokens)

### Pattern for All Agents

```markdown
# [Agent Name]

[1-2 sentence purpose]

## Knowledge Sources

- List of docs to read when needed
- NOT embedded inline

## Available Tools

- Tool name and brief description
- Include pruneFor/limit parameters where applicable
- When to use each tool

## Guidelines

- Core principles (3-5 bullets)
- Context-saving strategies

Keep it under 500 tokens total.
```

---

## Migration Checklist

### Immediate (Today)

- [ ] Create `prompts/vault-architect-minimal.md`
- [ ] Update Vault Agent instructions in data.json
- [ ] Test: Verify agent still works with minimal prompt
- [ ] Monitor: Check if context usage improved

### Tomorrow

- [ ] Add `list_files` tool with limit parameter
- [ ] Add `search_vault` tool with limit parameter
- [ ] Update Vault Agent prompt to reference new tools
- [ ] Test: Verify new tools work

### This Week

- [ ] Add `ContextTracker` utility
- [ ] Integrate context logging in server
- [ ] Add sliding window logic
- [ ] Add `maxContextMessages` setting
- [ ] Test: Monitor context usage in console

### Later (Only if Needed)

- [ ] Implement pruning agent
- [ ] Add conversation summarization
- [ ] Fine-tune token limits per agent

---

## Expected Results

### Before Optimization
```
Context: 117,367 tokens
Status: TRUNCATING (removing 116k from middle)
Performance: DEGRADED
```

### After Phase 1-3 (Immediate)
```
Context: ~30,000 tokens
Status: HEALTHY
Performance: GOOD
Savings: 87k tokens (74% reduction)
```

### After Phase 4-5 (This Week)
```
Context: ~25,000 tokens (capped)
Status: VERY HEALTHY
Performance: EXCELLENT
Visibility: Full token tracking
```

---

## Testing Strategy

### 1. Test Minimal Prompts
```
1. Update Vault Agent prompt
2. Ask: "Help me build a finance tracker"
3. Verify: Agent reads plugin-links.md when needed
4. Verify: Agent knows about tools
5. Verify: Agent uses tools appropriately
```

### 2. Test Tool Pruning
```
1. Have agent read large file with pruneFor
2. Check output size vs full file
3. Verify: Agent gets what it needs
```

### 3. Test Context Window
```
1. Have long conversation (20+ messages)
2. Check console: verify sliding window activates
3. Verify: Agent still has necessary context
```

### 4. Monitor Token Usage
```
1. Start conversation
2. Watch console for [Context] logs
3. Track token growth over time
4. Verify: Stays under 50k tokens
```

---

## Rollback Plan

If minimal prompts cause issues:

1. **Keep minimal structure** but add back critical info
2. **Hybrid approach**: Brief inline + reference to docs
3. **Per-agent tuning**: Some agents need more context than others

---

## Success Metrics

- Context usage: < 50,000 tokens consistently
- No truncation warnings from LM Studio
- Agent performance: No degradation in quality
- Response time: Improved (less context to process)
- User experience: No noticeable changes

---

## Prompt Files Summary

### Created Minimal Prompts

All optimized prompts are in the `prompts/` directory:

1. **`prompts/vault-architect-minimal.md`**
   - Token count: ~450 (vs ~1100 in vault-architect-v2.md)
   - Savings: 650 tokens per message
   - Ready to use immediately

2. **`prompts/orchestrator-minimal.md`**
   - Token count: ~250 (vs ~800 in orchestrator.md)
   - Savings: 550 tokens per message
   - Ready to use immediately

### Comparison Table

| Agent | Old Prompt | Old Tokens | New Prompt | New Tokens | Savings |
|-------|------------|------------|------------|------------|---------|
| Orchestrator | `orchestrator.md` | 800 | `orchestrator-minimal.md` | 250 | 550 |
| Vault Agent | `vault-architect-v2.md` | 1100 | `vault-architect-minimal.md` | 450 | 650 |

**Total per-message savings**: 1200 tokens
**Over 50-message conversation**: 60,000 tokens saved

### How to Apply

Update agent instructions in `data.json`:
```json
{
  "name": "Orchestrator Agent",
  "instructions": "[Copy content from prompts/orchestrator-minimal.md]"
},
{
  "name": "Vault Agent",
  "instructions": "[Copy content from prompts/vault-architect-minimal.md]"
}
```

Or update via the Obsidian plugin settings UI.

---

## Notes

- All phases maintain tool awareness
- Agents explicitly know what tools they have
- Agents use tools judiciously (only when needed)
- Context savings compound across conversation
- Monitor early, adjust as needed
- Simpler solutions first, complex only if needed
- **Minimal prompts are production-ready** - just copy/paste into settings
