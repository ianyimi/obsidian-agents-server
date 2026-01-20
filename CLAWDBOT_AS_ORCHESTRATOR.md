# Clawdbot as Orchestrator with Obsidian Agents Server

This document details the recommended integration approach: using clawdbot as the orchestration layer while your obsidian-agents-server provides the actual agent intelligence with full Obsidian API access.

---

## Key Insight: Your Server IS Already a Model Provider

Your obsidian-agents-server exposes `/v1/chat/completions` - the standard OpenAI API. Clawdbot can connect to any OpenAI-compatible endpoint as a "model provider." This means:

**Your agents appear to clawdbot as "models"** - not skills, not tools, not MCP servers - just models that happen to have tools and Obsidian access built in.

---

## Architecture

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
- Clawdbot config - handles orchestration

**Next steps:**
1. Install clawdbot on Mac Studio
2. Set up BlueBubbles for iMessage
3. Add the config above
4. Ensure Obsidian + your plugin is running
5. Test via iMessage

This is the simplest path to getting clawdbot + your existing system working together.
