# Clawdbot as Orchestrator with Obsidian Agents Server

This document details the recommended integration approach: using clawdbot as the orchestration layer while your obsidian-agents-server provides the actual agent intelligence with full Obsidian API access.

**Last Updated:** 2026-01-20 with GPT 5.2 workflow improvements

---

## Key Insight: Your Server IS Already a Model Provider

Your obsidian-agents-server exposes `/v1/chat/completions` - the standard OpenAI API. Clawdbot can connect to any OpenAI-compatible endpoint as a "model provider." This means:

**Your agents appear to clawdbot as "models"** - not skills, not tools, not MCP servers - just models that happen to have tools and Obsidian access built in.

---

## Refined Architecture: Multi-Agent System Pattern

Building on the base integration, the recommended topology uses multiple specialized agents:

### Three-Tier Agent Architecture

1. **Router Agent (Clawdbot)** - Optional but recommended
   - Only does intent classification and selects the correct system agent
   - Has **no direct OAS tool access**
   - Manages iMessage command surface

2. **System Agents (Clawdbot)** - One per vault system
   - Each has its own workspace + memory
   - Each can only call its allowlisted OAS agent(s) for that system
   - Maintains minimal "system briefs" and run logs (pointers, not vault content)
   - Acts as transaction coordinator for multi-step workflows

3. **OAS Agents (OAS server)** - Execute actual vault actions
   - Execute vault operations following structured Task Contracts
   - Follow operation-tier policy for confirmations
   - Return structured results to Clawdbot

---

## Critical Design Principles

### 1. Enforce Boundaries with Configuration, Not Prompts

**Principle:** Prompt instructions drift; configuration boundaries do not.

**Implementation:** For each Clawdbot system agent, expose a **single purpose-built tool** that:
- Hardcodes `baseURL = http://localhost:<oasPort>`
- Hard-allowlists `model` values (the OAS agent names it may invoke)
- Optionally hard-allowlists operation tiers (read/append/modify/delete)
- Rejects any request outside the allowlist

**Avoid:** Giving system agents a generic HTTP client that can call arbitrary endpoints.

### 2. Standardize a Task Contract for Clawdbot → OAS Calls

**Why:** If Clawdbot consistently sends high-signal, structured instructions, OAS agents can act deterministically without needing to "fetch extra context" from Clawdbot workspaces.

**Task Contract Fields:**
- `intent`: one sentence outcome
- `system`: which vault system this belongs to
- `context_budget`: `minimal | normal | heavy`
- `operation_tier`: `0_read | 1_append | 2_modify | 3_destructive`
- `scope_allowlist`: folders/tags/note patterns allowed to read/write
- `inputs`: explicit note paths/IDs, excerpts, and user-provided data
- `constraints`: style/formatting requirements; disallowed actions
- `outputs`: what to return (diff summary, changed note list, new note paths)
- `approval`: `auto | propose`

**Example Task Contract:**
```yaml
TASK_CONTRACT:
  intent: "Add a meeting summary to the Project X log and create follow-up tasks"
  system: "Projects/Project X"
  context_budget: minimal
  operation_tier: 1_append
  scope_allowlist:
    read:
      - "Projects/Project X/**"
    write:
      - "Projects/Project X/**"
  inputs:
    target_notes:
      - "Projects/Project X/Log.md"
    meeting_notes_excerpt: |
      ...
  constraints:
    - "Do not edit notes outside the allowlist"
    - "No renames/moves"
  outputs:
    return:
      - "summary"
      - "changed_notes"
      - "diff_summary"
  approval: auto
```

### 3. Operation Tiers + Confirmation Gates

**Tier Model:**
- **Tier 0: Read-only** — safe, no confirmation needed
- **Tier 1: Append-only** — usually safe, no confirmation needed
- **Tier 2: Modify existing content** — propose first unless user explicitly says "apply"
- **Tier 3: Destructive (delete/move/rename)** — always propose and require explicit confirmation

**Workflow:**
1. Clawdbot sends Task Contract with `operation_tier` and `approval`
2. OAS returns either:
   - **Proposal**: plan + write-set + diff summary (Tier 2/3 default)
   - **Applied report**: changed notes + diff summary (Tier 0/1 or approved Tier 2/3)
3. Clawdbot asks for confirmation only when required

### 4. Per-System Workspace Layout (Clawdbot)

Keep workspaces small and operational; avoid copying vault content into workspace memory.

**Recommended files per system agent workspace:**

- `SYSTEM_BRIEF.md`
  - Canonical note paths (pointers)
  - Naming conventions
  - Allowed scope
  - Common workflows and "done means"

- `STATE.json`
  - Machine-readable pointers (e.g., canonical files, last-run ids)

- `runs/YYYY-MM-DD/<runId>.md`
  - Request summary
  - Task Contract sent to OAS
  - OAS response summary
  - Changed note list + diff summary
  - Follow-ups

**Guideline:** Store *references and summaries*, not whole note bodies.

**Template: SYSTEM_BRIEF.md**
```md
# System Brief: <System Name>

## Purpose
...

## Canonical locations
- Root: ...
- Index note: ...
- Logs: ...

## Conventions
- ...

## Allowed scope
- Read: ...
- Write: ...

## Default operation tier
- ...
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              YOUR PHONE                                  │
│                         (iMessage / WhatsApp)                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLAWDBOT GATEWAY                                │
│                         (Mac Studio)                                    │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  CLAWDBOT FEATURES (you get ALL of these)                       │   │
│  │                                                                  │   │
│  │  • Session Management     - persistent conversations            │   │
│  │  • Memory System          - MEMORY.md + daily logs              │   │
│  │  • Vector Search          - semantic memory search              │   │
│  │  • Auto Compaction        - with pre-compaction memory flush    │   │
│  │  • Multi-Channel          - iMessage, WhatsApp, Telegram, etc   │   │
│  │  • Agent Bindings         - route channels to agents            │   │
│  │  • Built-in Tools         - browser, canvas, nodes, web search  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                    model: "obsidian/vault-agent"                       │
│                                    │                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                         HTTP (localhost:2345)
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     OBSIDIAN-AGENTS-SERVER                              │
│                     (Obsidian Plugin)                                   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  YOUR FEATURES (unchanged)                                      │   │
│  │                                                                  │   │
│  │  • Obsidian API Access    - plugin.app.vault.*                  │   │
│  │  • Omnisearch             - full-text + semantic vault search   │   │
│  │  • Templater              - template-based file creation        │   │
│  │  • Vault Tools            - read/write/create/delete files      │   │
│  │  • MCP Servers            - your existing MCP integrations      │   │
│  │  • Agent-as-Tool          - agents calling other agents         │   │
│  │  • Context Management     - your AgentContextManager            │   │
│  │  • Folder Restrictions    - included/excluded paths per agent   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                         model: LMStudio                                │
│                                    │                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                         HTTP (localhost:1234)
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           LMSTUDIO                                      │
│                    (Local Model Inference)                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Do You Lose Clawdbot Features? NO.

This is the critical point: **Clawdbot's features operate at the session/gateway layer, not the model layer.**

When clawdbot sends a request to your server (as a "model"), it:

1. **Maintains its own session** - The conversation history is stored in clawdbot's session system
2. **Manages memory** - Before compaction, clawdbot flushes important info to MEMORY.md
3. **Handles channels** - iMessage/WhatsApp routing is clawdbot's job
4. **Applies its tools** - Clawdbot can ALSO give tools to your agents (browser, web_search, etc.)

**Your server is just the "brain" that processes each turn.** Clawdbot wraps it with:
- Session persistence
- Memory injection
- Channel delivery
- Tool augmentation (optional)

### How the Conversation Flows

```
1. User sends iMessage: "Search my vault for notes about clawdbot"

2. Clawdbot receives message:
   - Loads session history
   - Injects MEMORY.md context
   - Injects AGENTS.md instructions
   - Builds messages array

3. Clawdbot calls YOUR server:
   POST http://localhost:2345/v1/chat/completions
   {
     "model": "vault-agent",
     "messages": [
       { "role": "system", "content": "..." },      // Clawdbot's system prompt
       { "role": "user", "content": "..." },        // Memory context
       { "role": "user", "content": "Search my vault for notes about clawdbot" }
     ],
     "stream": true
   }

4. YOUR server processes:
   - Your agent uses omni_search tool
   - Calls Obsidian APIs
   - LMStudio generates response
   - Streams back to clawdbot

5. Clawdbot receives response:
   - Saves to session transcript
   - Updates memory if needed
   - Delivers to iMessage

6. User sees response in iMessage
```

---

## Configuration

### Clawdbot Config (`~/.clawdbot/clawdbot.json`)

```json5
{
  // Your Obsidian server as a model provider
  models: {
    providers: {
      obsidian: {
        baseUrl: "http://localhost:2345/v1",
        api: "openai-completions",
        // List all agents from your plugin as "models"
        models: [
          {
            id: "vault-agent",
            name: "Vault Agent",
            contextWindow: 128000,  // Match your LMStudio model
            maxTokens: 8192
          },
          {
            id: "research-agent",
            name: "Research Agent",
            contextWindow: 128000,
            maxTokens: 8192
          }
        ]
      }
    }
  },

  // Agent configuration
  agents: {
    defaults: {
      // Use your Obsidian vault agent as the default
      model: { primary: "obsidian/vault-agent" },

      // Clawdbot workspace for memory
      workspace: "~/clawd",

      // Memory settings (clawdbot manages this)
      memorySearch: {
        enabled: true,
        provider: "local"  // or "openai" for better semantic search
      },

      // Compaction settings
      compaction: {
        reserveTokensFloor: 20000,
        memoryFlush: {
          enabled: true,
          softThresholdTokens: 4000
        }
      }
    }
  },

  // Channel configuration
  channels: {
    // iMessage via BlueBubbles
    bluebubbles: {
      enabled: true,
      url: "http://localhost:1234",  // BlueBubbles server
      password: "YOUR_BLUEBUBBLES_PASSWORD"
    }
  }
}
```

### Alternative: Multiple Agents with Different Backends

If you want SOME conversations to go directly to LMStudio (no Obsidian) and others to your vault agents:

```json5
{
  models: {
    providers: {
      // Direct LMStudio access (no Obsidian tools)
      lmstudio: {
        baseUrl: "http://localhost:1234/v1",
        api: "openai-completions",
        models: [
          { id: "qwen-coder", name: "Qwen Coder", contextWindow: 128000 }
        ]
      },
      // Your Obsidian server (full vault access)
      obsidian: {
        baseUrl: "http://localhost:2345/v1",
        api: "openai-completions",
        models: [
          { id: "vault-agent", name: "Vault Agent", contextWindow: 128000 }
        ]
      }
    }
  },

  agents: {
    list: [
      {
        id: "chat",
        name: "General Chat",
        model: "lmstudio/qwen-coder",  // Direct to LMStudio
        workspace: "~/clawd-chat"
      },
      {
        id: "vault",
        name: "Vault Assistant",
        model: "obsidian/vault-agent",  // Through your Obsidian plugin
        workspace: "~/clawd-vault"
      }
    ]
  },

  // Route based on channel or trigger
  bindings: [
    // Send "vault" keyword messages to vault agent
    // (You'd implement this with a custom binding or just use /agent vault)
    { agentId: "vault", match: { channel: "bluebubbles" } }
  ]
}
```

---

## What Happens in Each Layer

### Clawdbot Layer (Session + Memory + Channels)

| Feature | How It Works |
|---------|--------------|
| **Session Persistence** | Clawdbot stores conversation in `~/.clawdbot/agents/main/sessions/*.jsonl`. Your server is stateless - clawdbot sends full history each request. |
| **Memory System** | Clawdbot maintains `~/clawd/MEMORY.md` and `~/clawd/memory/*.md`. Injects relevant memories into system prompt before calling your server. |
| **Memory Flush** | Before compaction, clawdbot prompts itself to save important info. This happens at clawdbot layer, not your server. |
| **Channel Delivery** | Clawdbot handles iMessage/WhatsApp formatting, chunking long messages, media attachments. |
| **Tool Augmentation** | Clawdbot can ADD tools (browser, web_search) on top of what your server provides. |

### Your Server Layer (Obsidian + Tools + Models)

| Feature | How It Works |
|---------|--------------|
| **Obsidian APIs** | Full access to `plugin.app.vault.*`, Omnisearch, Templater. |
| **Your Tools** | vault_search, read_file, create_file, etc. - all work unchanged. |
| **Agent-as-Tool** | Your agents can still call each other via `.asTool()`. |
| **Context Management** | Your `AgentContextManager` still runs for LMStudio context limits. |
| **MCP Servers** | Your existing MCP integrations work unchanged. |

---

## Answering Your Questions

### "Can clawdbot agents talk to agents in this project, receive a response, then continue conversation?"

**Yes, exactly.** Each turn:
1. Clawdbot sends messages to your server
2. Your server processes (may involve multiple tool calls, agent-to-agent calls)
3. Your server returns final response
4. Clawdbot saves to session, delivers to user
5. Next user message continues the same flow

Clawdbot doesn't know or care that your "model" is actually an agent system with tools. It just sends messages and gets responses.

### "Would I lose clawdbot features like session management and memory?"

**No.** Those features operate at the clawdbot layer, independent of what model/server you use. You get:
- ✅ Session persistence (clawdbot)
- ✅ Memory system (clawdbot)
- ✅ Compaction with memory flush (clawdbot)
- ✅ Multi-channel (clawdbot)
- ✅ Obsidian APIs (your server)
- ✅ Your custom tools (your server)
- ✅ Your context management (your server)

### "Is this just a proxy?"

**More than a proxy.** Clawdbot adds:
- Persistent memory that survives compaction
- Session history management
- Multi-channel routing
- Built-in tools you can optionally enable
- Agent bindings for different contexts
- Voice/Canvas if you want them

Your server provides the "brain" with Obsidian access. Clawdbot provides the "nervous system" connecting it to the world.

---

## Comparison: Proxy vs Orchestrator

| Approach | Memory | Sessions | Multi-Agent | Your Tools |
|----------|--------|----------|-------------|------------|
| **Pure Proxy** (forward requests only) | ❌ | ❌ | ❌ | ✅ |
| **Clawdbot as Orchestrator** | ✅ | ✅ | ✅ | ✅ |
| **Full Migration** | ✅ | ✅ | ✅ | ⚠️ (need to port) |

The orchestrator approach gives you everything without porting your tools.

---

## Optional Enhancements

### 1. Health Check Endpoint

Add to your server so clawdbot can verify it's running:

```typescript
app.get("/health", (c) => c.json({ status: "ok" }))
```

### 2. Better Model Metadata

Enhance your `/v1/models` response:

```typescript
app.get("/v1/models", async (c) => {
  const models = Object.values(this.agents).map((agent) => ({
    id: agent.instance.name,
    object: "model",
    created: Date.now(),
    owned_by: "obsidian-agents-server",
    // Add capabilities
    capabilities: {
      tools: true,
      vision: false,
      function_calling: true
    },
    // Add context window info
    context_window: 128000
  }))
  return c.json({ object: "list", data: models })
})
```

### 3. Clawdbot Tool Augmentation

You can give clawdbot's built-in tools to your agents:

```json5
{
  agents: {
    defaults: {
      model: "obsidian/vault-agent",
      // Add clawdbot tools on top of your server's tools
      tools: {
        allow: ["web_search", "web_fetch", "browser"]
      }
    }
  }
}
```

Now your vault agent can also search the web and control a browser, handled by clawdbot.

### 4. Auto-start Your Server

Add a launchd plist or systemd service to ensure your Obsidian plugin server starts on boot (requires Obsidian to be running).

---

## Advanced Patterns from GPT 5.2 Workflow Improvements

### iMessage Command Surface

Suggested commands for Clawdbot Router/System agents:
- `/help` — list available systems and commands
- `/system <name>` — switch current thread/system context
- `/read <query>` — read-only lookup (Tier 0)
- `/add <...>` — append workflow (Tier 1)
- `/edit <...>` — modify workflow (Tier 2, propose by default)
- `/danger <...>` — destructive workflow (Tier 3, always propose)
- `/status` — show last run, pending proposals, and canonical pointers

**Implementation note:** You can either keep one iMessage thread with a Router agent, or dedicate one thread per system agent. The Router improves UX when you scale beyond a handful of systems.

### Multi-Agent Workflows

**Principle:** The Clawdbot system agent is the transaction coordinator.

**Pattern:**
1. System agent decomposes request into steps
2. Executes steps serially (or controlled concurrency if safe)
3. Writes a run log with step outputs and the final write-set
4. Returns one consolidated response to you

**Why:** Reduces partial completion and enables safe resume/retry.

### Capabilities Registry for OAS Agents

As your number of OAS agents grows, system agents will become inconsistent at prompting unless they share a single source of truth.

**Add a registry:** Create `capabilities/<agentName>.json` (or a combined registry) describing:
- Supported actions
- Required inputs
- Output guarantees
- Recommended operation tiers
- Confirmation defaults

System agents can reference only their relevant entries.

### Controlled Workspace Access by Subagents

If you use subagents under a system agent, avoid "free browsing" of the workspace.

**Preferred approach:** Expose a small retrieval interface:
- `get_system_brief()`
- `get_recent_runs(n)`
- `get_file(path)` for allowlisted paths only

Require the subagent to justify why it needs the file (one sentence). This keeps runs efficient and prevents slow, sprawling context loads.

### Local Performance Optimization

If local model performance is your constraint, optimize *context and workflow*, not just model selection.

**Recommended tactics:**
- Default `context_budget: minimal` and escalate only when needed
- Keep system briefs short and stable
- Prefer structured Task Contracts over conversational "do the thing" instructions
- Cache lightweight indexes (note titles/paths/tags) locally in OAS (refresh on schedule)
- Use small/faster models for Router and "proposal drafting"; reserve larger local models for heavy refactors

---

## Rollout Checklist

1. **Define agents**
   - Create one Clawdbot system agent per OAS agent/system
   - Optionally create one Router agent

2. **Implement tool allowlists**
   - Each system agent gets only its `oas_call_allowlisted()` tool
   - Router agent gets no OAS tools

3. **Add Task Contract**
   - Decide a canonical schema (YAML or JSON) and enforce it

4. **Add operation tier policy**
   - Ensure Tier 2/3 produces proposals and requires confirmation

5. **Workspace layout**
   - Add `SYSTEM_BRIEF.md`, `STATE.json`, and `runs/` structure

6. **Logging and audit**
   - Every run writes a run log with changed note list

7. **Performance tuning**
   - Start with minimal context budgets
   - Measure the pain points before increasing complexity

---

## Summary

**Recommended approach:** Configure clawdbot to use your obsidian-agents-server as a model provider.

**What you get:**
- All clawdbot features (memory, sessions, channels)
- All your features (Obsidian APIs, tools, context management)
- No code changes to your server
- Simple JSON config
- Single HTTP hop on localhost (negligible latency)

**What you maintain:**
- Obsidian plugin (your server) - handles vault operations
- Clawdbot config - handles orchestration and system-specific workspaces

**Next steps:**
1. Install clawdbot on Mac Studio
2. Set up BlueBubbles for iMessage
3. Add the base config above
4. Ensure Obsidian + your plugin is running
5. Test basic integration via iMessage
6. **Then implement workflow improvements:**
   - Add Task Contract schema to OAS agents
   - Implement tool allowlists for system agents
   - Create per-system workspaces with SYSTEM_BRIEF.md
   - Add operation tier policy
   - Set up Router agent (optional)

**Priority recommendation from GPT 5.2 conversation:**
Start by implementing the tool allowlist wrapper and Task Contract. Those two changes drive most of the reliability gains.

**Key principle:**
Keep workspace memory "pointer-based," not "content-based," to avoid stale shadows of your vault.

---

## Optional Future Enhancement: Cloud Advisor Pattern

If you later want better reasoning while maintaining privacy, add a cloud "advisor" that only sees **sanitized summaries** produced locally.

**Pattern:**
- Keep it separate from vault tools
- Never pass raw note bodies
- Only send sanitized summaries generated by local models
- Use for high-level planning/reasoning only
- All vault operations still go through local OAS agents

This maintains privacy while optionally leveraging cloud model capabilities for specific reasoning tasks.

---

## Document Version History

- **2026-01-20**: Added GPT 5.2 workflow improvements including:
  - Three-tier agent architecture (Router → System Agents → OAS Agents)
  - Task Contract standardization
  - Operation tier system (0-3) with confirmation gates
  - Tool allowlist enforcement pattern
  - Per-system workspace layout guidelines
  - iMessage command surface recommendations
  - Multi-agent workflow patterns
  - Capabilities registry for OAS agents
  - Local performance optimization tactics
  - Rollout checklist

- **Original**: Base integration architecture with Clawdbot as model provider orchestrator
