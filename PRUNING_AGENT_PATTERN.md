# Pruning Agent Pattern

## Concept

A lightweight agent that extracts only relevant information from verbose tool outputs, reducing context size for specialized agents.

## Why This Works

1. **Simple**: One-way transformation (tool output → pruned output)
2. **Cheap**: Uses fast 8B model, quick operations
3. **Optional**: Can be toggled per tool call
4. **Composable**: Works with existing tools
5. **Targeted**: Only applied where needed (verbose tools)

## Architecture

```
Specialized Agent
    ↓ (calls tool with context)
Tool Execution
    ↓ (verbose output + original context)
Pruning Agent (if enabled)
    ↓ (minimal relevant output)
Back to Specialized Agent
```

## Implementation

### 1. Add `pruneOutput` Parameter to Tools

```typescript
// Example: read_file tool
vaultTool({
  id: VAULT_TOOLS.readFile.id,
  tool: tool({
    name: VAULT_TOOLS.readFile.id,
    description: "Read file contents",
    parameters: z.object({
      path: z.string(),
      cache: z.boolean().default(false),
      // NEW: Optional pruning
      pruneFor: z.string().optional().describe(
        "If provided, prune output to only what's relevant for this question/task"
      )
    }),
    async execute({ path, cache, pruneFor }) {
      const file = plugin.app.vault.getFileByPath(path)
      if (!file) throw new Error(`File not found: ${path}`)

      const content = cache
        ? await plugin.app.vault.cachedRead(file)
        : await plugin.app.vault.read(file)

      // If pruning requested and content is large
      if (pruneFor && content.length > 1000) {
        return await pruneOutput(content, pruneFor, plugin)
      }

      return { path, content }
    }
  })
})
```

### 2. Create Pruning Agent

```typescript
// In agents configuration
{
  id: "pruning-agent",
  name: "Pruning Agent",
  enabled: true,
  useAsTool: false,
  instructions: `You extract relevant information from verbose content.

Given:
- Question/Context: What the user needs to know
- Content: Raw data (file contents, docs, etc.)

Your job:
1. Read the question to understand what's needed
2. Scan content for relevant information
3. Return ONLY the parts that answer the question
4. Format as minimal JSON or text

Be aggressive. If something doesn't directly help answer the question, remove it.

Example:
Question: "What's the date format preference?"
Content: [3000 chars of file with "Date format: YYYY-MM-DD" buried in it]
Output: { "date_format": "YYYY-MM-DD" }

Never return more than 500 tokens unless absolutely necessary.`,
  modelProvider: "lmstudio",
  model: "qwen3-8b", // Fast model
  vaultTools: {},
  agentTools: [],
  mcpTools: [],
  tools: []
}
```

### 3. Pruning Helper Function

```typescript
// src/lib/pruning.ts

import ObsidianAgentsServer from "~/index"
import { Agent, Runner } from "@openai/agents"

const pruningRunner = new Runner({ tracingDisabled: true })

export async function pruneOutput(
  content: string,
  question: string,
  plugin: ObsidianAgentsServer
): Promise<any> {
  // Get pruning agent
  const pruningAgent = Object.values(plugin.agents).find(
    a => a.name === "Pruning Agent"
  )

  if (!pruningAgent) {
    // If no pruning agent, return truncated content
    return {
      content: content.slice(0, 1000) + "\n[...truncated...]",
      length: content.length,
      truncated: true
    }
  }

  // Ask pruning agent to extract relevant info
  const prompt = `Question/Context: ${question}

Content to prune:
${content}

Extract only what's relevant to the question. Be minimal.`

  try {
    const result = await pruningRunner.run(pruningAgent, [
      { role: 'user', content: prompt }
    ])

    // Extract response
    const output = result.output?.find(
      (item: any) => item.role === 'assistant'
    )

    const pruned = output?.content?.[0]?.text || content

    console.log(`[Pruning] Reduced from ${content.length} to ${pruned.length} chars`)

    return { pruned, originalLength: content.length }

  } catch (err) {
    console.error('[Pruning] Error:', err)
    // Fallback to truncation
    return {
      content: content.slice(0, 1000),
      error: 'Pruning failed'
    }
  }
}
```

### 4. Usage Example

```typescript
// Specialized agent calls tool
read_file({
  path: "Agent Docs/Vault/plugin-links.md",
  pruneFor: "What are the top 5 most important plugins for building systems?"
})

// Tool executes, file is 2000+ chars
// Pruning agent receives:
// - Question: "What are the top 5 most important plugins..."
// - Content: [full plugin-links.md]

// Pruning agent returns:
{
  pruned: `Top 5 plugins for systems:
1. Templater ⭐⭐⭐⭐⭐ - Dynamic templates
2. Datacore ⭐⭐⭐⭐⭐ - High-performance queries
3. Metadata Menu ⭐⭐⭐⭐⭐ - Data schemas
4. Charts ⭐⭐⭐⭐ - Visualization
5. Tasks ⭐⭐⭐⭐ - Task management`,
  originalLength: 2156
}

// Specialized agent sees minimal output (~150 chars instead of 2000+)
```

## When to Use Pruning

### Good Use Cases (High Value)
- ✅ Reading documentation files (plugin-links.md)
- ✅ Searching multiple files (return only matches)
- ✅ Reading large configuration files
- ✅ Processing list results (100s of files → relevant few)

### Bad Use Cases (Low Value)
- ❌ Short responses (< 1000 chars)
- ❌ Already structured data
- ❌ When agent needs full context
- ❌ Binary/precise data (code, JSON)

## Cost/Benefit Analysis

**Costs:**
- Extra API call per pruned tool output (~0.5s latency)
- Tokens for pruning agent (usually <1000 tokens)
- Complexity in error handling

**Benefits:**
- Massive context savings (2000+ chars → 200 chars = 90% reduction)
- Specialized agent sees cleaner inputs
- Extends usable context window significantly

**Net**: Worthwhile for verbose tools (docs, search, large files)

## Optimization: Smart Pruning

Only prune when output is large:

```typescript
async execute({ path, cache, pruneFor }) {
  const content = await vault.read(file)

  // Only prune if:
  // 1. Pruning requested
  // 2. Content is large (> 1000 chars)
  // 3. Question is specific (not "read everything")
  const shouldPrune = pruneFor
    && content.length > 1000
    && !pruneFor.toLowerCase().includes('everything')
    && !pruneFor.toLowerCase().includes('full')

  if (shouldPrune) {
    return await pruneOutput(content, pruneFor, plugin)
  }

  return { path, content }
}
```

## Integration with Other Strategies

```
Phase 1-3: Reduce baseline context
    ↓
Phase 4: Add sliding window
    ↓
Phase 5: Add pruning agent (for remaining verbose tools)
    ↓
Phase 6: Add summarization (if still needed)
```

Pruning agent is **Phase 5** - only needed after simpler optimizations.

## Agent Prompt Adjustment

Specialized agents should know about pruning:

```markdown
## Tools

Most tools support optional `pruneFor` parameter:
- Use it when reading large files/docs
- Describe what you need from the output
- Example: `pruneFor: "date format preferences"`
- Saves context by returning only relevant info

Use pruning for:
- Documentation files
- Large vault files
- Search results

Don't use pruning for:
- Small files (< 1000 chars)
- Structured data (JSON, YAML)
- Code files
```

## Implementation Priority

1. ✅ **Phase 1-3**: Trim prompts, lazy load, prune tool outputs (manual)
2. ✅ **Phase 4**: Sliding window
3. ✅ **Phase 5**: Pruning agent (this pattern)
4. ⏸️ **Phase 6**: Conversation summarization (if still needed)

Start with simple strategies. Add pruning agent only if still hitting limits after Phase 1-4.

## Example: Before and After

### Before (117k tokens causing truncation)
```
Agent prompt: 1100 tokens
Plugin docs in prompt: 2000 tokens
10 tool calls reading large files: 50,000 tokens
Conversation history: 64,000 tokens
---
Total: 117,100 tokens → TRUNCATION
```

### After Phase 1-3
```
Agent prompt: 300 tokens
Docs loaded on-demand: 0 tokens (until needed)
Tool outputs excerpted: 10,000 tokens
Conversation history: 20,000 tokens (sliding window)
---
Total: 30,300 tokens → HEALTHY
```

### After Phase 5 (with pruning)
```
Agent prompt: 300 tokens
Docs pruned when loaded: 500 tokens (vs 2000)
Tool outputs pruned: 2,000 tokens (vs 10,000)
Conversation history: 20,000 tokens
---
Total: 22,800 tokens → VERY HEALTHY
```

## Code Location

- Pruning agent config: `data.json` or via settings UI
- Pruning function: `src/lib/pruning.ts`
- Tool integration: Update individual tools in `src/tools/vault.ts`
- Agent instructions: `prompts/` folder for specialized agents

## Testing

```typescript
// Test pruning reduction
const longContent = "..." // 5000 chars
const pruned = await pruneOutput(
  longContent,
  "What's the main point?",
  plugin
)

console.log(`Reduced from ${longContent.length} to ${pruned.length}`)
// Expected: ~90% reduction
```

## Notes

- Pruning agent uses cheap 8B model (fast, low cost)
- Fallback to truncation if pruning fails
- Optional per tool call (specialized agent decides)
- Works best with specific questions (not "give me everything")
- Can be disabled globally via settings if needed

---

**Status**: Design complete, ready to implement after Phase 1-4
