# Phase 1: Core Agent Framework

## Overview

**Goal:** Build the foundational multi-agent system running on Mac Studio that client devices can connect to. Setup client devices (OWUI, phone) and ensure connectivity. Begin using System Builder Agent to design and implement vault systems with agent assistance.

**Key Deliverables:**
- Multi-agent system (Orchestrator + Journal + System Builder)
- REST API for client connectivity
- Session management for persistent conversations
- Basic WebSocket for completion notifications
- Device ID system for control device designation
- Client device connectivity (OWUI, phone)
- Initial vault systems built with agent assistance

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                Mac Studio (Control Device)                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Obsidian Plugin (Agent Server)                         │ │
│  │  ├─ REST API (:8001)                                   │ │
│  │  ├─ WebSocket Server (:8002) [completion summaries]   │ │
│  │  ├─ Agents SDK                                         │ │
│  │  │  ├─ Orchestrator (qwen3-30b)                       │ │
│  │  │  ├─ Journal Agent (qwen3-8b)                       │ │
│  │  │  └─ System Builder Agent (qwen3-8b)                │ │
│  │  ├─ Session Manager (persistent conversations)        │ │
│  │  ├─ Direct Vault Access (app.vault.*)                 │ │
│  │  └─ LiveSync Plugin (automatic sync)                  │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ LM Studio (:1234)                                      │ │
│  │  ├─ qwen3-30b (orchestrator) ~20GB VRAM               │ │
│  │  └─ qwen3-8b (specialists) ~10GB VRAM                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              ↕ Network
┌─────────────────────────────────────────────────────────────┐
│                      Client Devices                          │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │ MacBook              │  │ Phone                │        │
│  │  ├─ OWUI             │  │  ├─ Browser/App      │        │
│  │  ├─ Obsidian+LiveSync│  │  ├─ OWUI/Other       │        │
│  │  └─ Client Plugin    │  │  └─ (read vault)     │        │
│  └──────────────────────┘  └──────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

---

## System Components

### 1. Agents

#### Orchestrator Agent
```typescript
{
    name: 'orchestrator',
    model: 'qwen/qwen3-30b-a3b-2507',
    instructions: `You are the central orchestrator for The Lab v2 vault.

    Analyze user queries and hand off to specialized agents:
    - journal_agent: Daily notes, tasks, scheduling, logging
    - system_builder_agent: Designing vault systems, plugin research, system implementation

    For complex queries involving multiple domains, hand off to multiple agents.
    Be concise. Always return [[wikilinks]] to created/updated notes.`,
    handoffs: [journalAgent, systemBuilderAgent]
}
```

#### Journal Agent
```typescript
{
    name: 'journal_agent',
    model: 'qwen3:8b',
    instructions: `You specialize in daily logging and task management.

    Use journals_create_today to create daily notes.
    Use journals_log_info to log tasks/notes quickly.
    Use search_notes to find past entries.

    CRITICAL: Daily note structure varies by day of week. Use journals_log_info when possible.
    Task syntax: Use 🔔 for scheduled tasks, 📅 for due dates, ⏫ for priority.
    Always return [[wikilinks]] to created notes.`,
    functions: [
        journals_create_today,
        journals_log_info,
        search_notes,
        util_get_datetime
    ]
}
```

#### System Builder Agent
```typescript
{
    name: 'system_builder_agent',
    model: 'qwen3:8b',
    instructions: `You specialize in helping users design and build vault systems.

    Your role:
    1. Work with user to understand what system they want to build
    2. Ask questions to clarify: purpose, scope, workflow, plugins needed
    3. Research plugin documentation to understand capabilities
    4. Design the system: folder structure, templates, metadata schemas
    5. Implement the system: create files, configure plugins, set up workflows
    6. Document the system for future reference

    Available systems to build (examples):
    - Goal tracking (OKRs, milestones, progress)
    - Finance management (expenses, budgets, accounts)
    - Restaurants & foods (reviews, recipes, favorites)
    - Entertainment (anime, manga, TV shows, movies, books)
    - Any other life tracking system user requests

    For each system, determine:
    - Which plugins to leverage (templater, dataview, metadata-menu, etc.)
    - What metadata schema to use (fileClass system)
    - How tasks/tracking will work (obsidian-tasks-plugin)
    - What templates are needed
    - How user will interact with it daily

    Use fetch_plugin_docs to research plugin capabilities.
    Use search_notes to see existing vault structure.
    Use util_create_file to create new files.
    Use util_edit_file to modify existing files.
    Use util_update_frontmatter to set metadata.

    Always collaborate with user - ask questions, get feedback, iterate.`,
    functions: [
        fetch_plugin_docs,
        search_notes,
        util_create_file,
        util_edit_file,
        util_update_frontmatter,
        util_list_files,
        util_get_datetime
    ]
}
```

### 2. REST API Endpoints

```
POST   /v1/chat/completions          # Main chat endpoint (OpenAI-compatible)
GET    /v1/models                    # List available agents
GET    /v1/status                    # Server health, queue status, LM Studio status
POST   /v1/tools/:toolName           # Direct tool invocation
GET    /v1/sessions                  # List active sessions
GET    /v1/sessions/:id              # Get session details
DELETE /v1/sessions/:id              # Clear session
POST   /v1/sessions/:id/clear        # Clear session history
```

### 3. WebSocket Server

```
WebSocket ws://mac-studio-ip:8002

Message Types (Phase 1):
{
    type: 'completion_summary',
    data: {
        sessionId: string,
        action: string,
        filesModified: string[],
        filesCreated: string[],
        summary: string,
        timestamp: number
    }
}

{
    type: 'error',
    data: {
        sessionId: string,
        error: string,
        timestamp: number
    }
}
```

### 4. Session Management

```typescript
interface Session {
    id: string;                    // UUID
    deviceId: string;              // Which client device
    agent: Agent;                  // Current agent
    messages: Message[];           // Conversation history
    metadata: {
        created: number;
        lastActivity: number;
        tags: string[];            // For organization
    };
}

// Storage: SQLite database in plugin data folder
// Persistence: Survives plugin reload/Obsidian restart
// Cleanup: Sessions inactive >7 days auto-archived
```

### 5. Device ID System

```typescript
interface PluginSettings {
    // Device identification
    deviceId: string;              // Auto-generated UUID on first install
    controlDeviceId: string;       // User pastes Mac Studio's deviceId here
    isControlDevice: boolean;      // Computed: deviceId === controlDeviceId

    // Server config (only used if isControlDevice)
    serverPort: number;            // Default: 8001
    websocketPort: number;         // Default: 8002

    // Plugin docs config (only used if isControlDevice)
    enabledPluginsForDocs: string[]; // Which plugins to fetch docs for
    fetchDocsOnStartup: boolean;   // Auto-fetch on plugin load
    pluginDocsCache: {             // Stored links to docs
        [pluginName: string]: {
            docsUrl: string;
            version: string;
            fetchedAt: number;
        }
    };
}

// Settings UI shows:
// - Current device ID (with copy button)
// - Input field for control device ID
// - Status indicator: "This is the control device" or "Connected to: Mac-Studio"
```

### 6. Functions for System Builder Agent

#### fetch_plugin_docs
```typescript
async function fetchPluginDocs(params: { pluginName: string }): Promise<any> {
    // 1. Check cache for existing docs URL
    const cached = this.settings.pluginDocsCache[pluginName];
    if (cached && Date.now() - cached.fetchedAt < 7 * 24 * 60 * 60 * 1000) {
        // Fetch from cached URL
        const response = await fetch(cached.docsUrl);
        return {
            plugin: pluginName,
            docs: await response.text(),
            url: cached.docsUrl,
            cached: true
        };
    }

    // 2. Search for docs (GitHub, plugin manifest, etc.)
    const manifest = this.getPluginManifest(pluginName);
    const docsUrl = manifest?.fundingUrl || manifest?.authorUrl;

    // 3. Fetch and cache
    if (docsUrl) {
        const response = await fetch(docsUrl);
        const docs = await response.text();

        // Save to cache
        this.settings.pluginDocsCache[pluginName] = {
            docsUrl,
            version: manifest.version,
            fetchedAt: Date.now()
        };
        await this.saveSettings();

        return { plugin: pluginName, docs, url: docsUrl, cached: false };
    }

    return { error: `No documentation found for ${pluginName}` };
}
```

#### util_create_file
```typescript
async function utilCreateFile(params: {
    filePath: string;
    content: string;
    openAfterCreate?: boolean;
}): Promise<any> {
    const { filePath, content, openAfterCreate = false } = params;

    // Check if file exists
    const exists = await this.app.vault.adapter.exists(filePath);
    if (exists) {
        return { error: `File already exists: ${filePath}` };
    }

    // Create file
    await this.app.vault.create(filePath, content);

    // Optionally open
    if (openAfterCreate) {
        await this.app.workspace.openLinkText(filePath, '', false);
    }

    return {
        success: true,
        filePath,
        message: `Created file: ${filePath}`
    };
}
```

#### util_list_files
```typescript
async function utilListFiles(params: {
    folder?: string;
    pattern?: string;
    recursive?: boolean;
}): Promise<any> {
    const { folder = '', pattern = '*.md', recursive = true } = params;

    const files = this.app.vault.getMarkdownFiles();
    let filtered = files;

    if (folder) {
        filtered = filtered.filter(f => f.path.startsWith(folder));
    }

    if (pattern !== '*.md') {
        const regex = new RegExp(pattern.replace('*', '.*'));
        filtered = filtered.filter(f => regex.test(f.name));
    }

    return {
        files: filtered.map(f => ({
            path: f.path,
            name: f.name,
            folder: f.parent?.path || ''
        })),
        count: filtered.length
    };
}
```

---

## Plugin Structure

```
obsidian-agent-server/
├── main.ts                      # Plugin entry point
├── manifest.json
├── styles.css
│
├── src/
│   ├── agents/
│   │   ├── orchestrator.ts      # Orchestrator agent definition
│   │   ├── journal-agent.ts     # Journal specialist
│   │   └── system-builder-agent.ts  # System builder specialist
│   │
│   ├── api/
│   │   ├── rest-server.ts       # REST API (Express/Fastify)
│   │   ├── websocket-server.ts  # WebSocket notifications
│   │   ├── routes.ts            # API route handlers
│   │   └── middleware.ts        # Auth, CORS, error handling
│   │
│   ├── functions/
│   │   ├── journals.ts          # Journal functions (direct vault access)
│   │   ├── search.ts            # Search functions
│   │   ├── util.ts              # Utility functions
│   │   └── plugin-docs.ts       # Plugin documentation fetching
│   │
│   ├── services/
│   │   ├── lm-studio-client.ts  # LM Studio connection
│   │   ├── health-monitor.ts    # LM Studio health checks
│   │   ├── request-queue.ts     # Queue manager
│   │   ├── session-manager.ts   # Session persistence (SQLite)
│   │   └── device-manager.ts    # Device ID management
│   │
│   ├── models/
│   │   └── types.ts             # TypeScript interfaces
│   │
│   └── ui/
│       └── settings-tab.ts      # Plugin settings UI
│
└── data/
    ├── sessions.db              # SQLite session storage
    └── plugin-docs-cache.json   # Cached plugin docs URLs
```

---

## Implementation Tasks

### 🎯 Current Status & Next Steps

**✅ Completed (Foundation)**
- Device ID system with settings UI
- Model provider abstraction (LMStudio working)
- Agent configuration system with full CRUD UI
- Basic Hono server initialized
- GET /v1/models endpoint (lists agents)
- CORS configured

**🚧 In Progress**
- POST /v1/chat/completions endpoint (started but incomplete)

**🔴 Critical Missing Pieces (Priority Order)**

1. **Start the Hono Server** - Without this, nothing works!
   - Use @hono/node-server's `serve()` function
   - Bind to 0.0.0.0 to allow network access
   - Store server instance for cleanup in onunload()
   - Add port configuration to settings

2. **Complete /v1/chat/completions Endpoint**
   - Extract model name and messages from request body
   - Find agent by name
   - Run agent with messages
   - Handle streaming vs non-streaming responses
   - Format response in OpenAI format

3. **Implement Agent Functions**
   - Create src/functions/ folder
   - Start with basic vault functions (search, read, create, edit)
   - These are needed for agents to actually do useful work

4. **Session Management**
   - Install better-sqlite3
   - Implement session persistence
   - Integrate with chat completions endpoint

5. **WebSocket Server** (for completion notifications)
   - Install ws
   - Create websocket server
   - Send notifications after agent completions

---

### 📝 Implementation Guidance for Critical Pieces

#### 1. Starting the Hono Server

**Update src/index.ts:106-143:**

```typescript
import { serve } from '@hono/node-server';

initializeServer(plugin: ObsidianAgentsServer) {
    if (!this.isControlDevice) {
        console.log('Not control device, skipping server initialization');
        return;
    }

    const app = new Hono();
    this.server = app;

    app.use("/*", cors())

    // ... existing routes ...

    // Start the server
    const port = this.settings.serverPort || 8001;
    const server = serve({
        fetch: app.fetch,
        port,
        hostname: '0.0.0.0', // Important for network access!
    });

    console.log(`🚀 Agents Server running on http://0.0.0.0:${port}`);
    console.log(`📝 Available agents: ${this.agents.map(a => a.name).join(', ')}`);

    // Store for cleanup
    this.httpServer = server;
}
```

**Update ObsidianAgentsServerSettings interface:**
```typescript
export interface ObsidianAgentsServerSettings {
    activeTab: string;
    deviceID: string;
    controlDeviceID: string;
    serverPort: number;          // ADD THIS
    websocketPort: number;       // ADD THIS
    modelProviders: ModelProviderSettings[]
    agents: AgentConfig[]
}

export const DEFAULT_SETTINGS: ObsidianAgentsServerSettings = {
    activeTab: "agents",
    deviceID: "",
    controlDeviceID: "",
    serverPort: 8001,            // ADD THIS
    websocketPort: 8002,         // ADD THIS
    modelProviders: [],
    agents: []
}
```

**Update plugin class:**
```typescript
export default class ObsidianAgentsServer extends Plugin {
    settings: ObsidianAgentsServerSettings;
    isControlDevice: boolean = false;
    modelProviders: ModelProvider[] = []
    agents: Agent[]
    server?: Hono
    httpServer?: any;  // ADD THIS for @hono/node-server instance

    onunload() {
        // Cleanup server
        if (this.httpServer) {
            this.httpServer.close();
            console.log('Agents server stopped');
        }
    }
}
```

#### 2. Completing /v1/chat/completions

**Replace src/index.ts:128-141 with:**

```typescript
app.post("/v1/chat/completions", async (c) => {
    try {
        const body = await c.req.json()
        const { model, messages, stream = false } = body;

        // Find agent by name
        const agent = plugin.agents.find(a => a.name === model);
        if (!agent) {
            return c.json({
                error: {
                    message: `Model '${model}' not found. Available models: ${plugin.agents.map(a => a.name).join(', ')}`,
                    type: 'invalid_request_error'
                }
            }, 404);
        }

        // Non-streaming response
        if (!stream) {
            const result = await agent.run({ messages });

            // Find the final text content
            let responseText = '';
            if (result.text) {
                responseText = result.text;
            } else if (result.messages && result.messages.length > 0) {
                const lastMessage = result.messages[result.messages.length - 1];
                if (lastMessage.role === 'assistant' && typeof lastMessage.content === 'string') {
                    responseText = lastMessage.content;
                }
            }

            return c.json({
                id: `chatcmpl-${Date.now()}`,
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: model,
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: responseText,
                    },
                    finish_reason: 'stop',
                }],
                usage: {
                    prompt_tokens: 0,
                    completion_tokens: 0,
                    total_tokens: 0,
                },
            });
        }

        // TODO: Implement streaming response using streamSSE
        // For now, fall back to non-streaming
        return c.json({
            error: {
                message: 'Streaming not yet implemented',
                type: 'not_implemented'
            }
        }, 501);

    } catch (err: any) {
        console.error('Error handling chat completion:', err);
        return c.json({
            error: {
                message: err?.message ?? "Internal Server Error",
                type: "internal_error"
            }
        }, 500);
    }
})
```

#### 3. Basic Agent Functions

**Create src/functions/vault.ts:**

```typescript
import { TFile, TFolder } from 'obsidian';
import ObsidianAgentsServer from '~/index';

export function createVaultFunctions(plugin: ObsidianAgentsServer) {
    return {
        search_notes: {
            description: 'Search for notes in the vault by content or filename',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query'
                    }
                },
                required: ['query']
            },
            execute: async ({ query }: { query: string }) => {
                const files = plugin.app.vault.getMarkdownFiles();
                const results = [];

                for (const file of files) {
                    const content = await plugin.app.vault.read(file);
                    if (content.toLowerCase().includes(query.toLowerCase()) ||
                        file.basename.toLowerCase().includes(query.toLowerCase())) {
                        results.push({
                            path: file.path,
                            name: file.basename,
                            excerpt: content.substring(0, 200)
                        });
                    }
                }

                return {
                    results: results.slice(0, 10),
                    total: results.length
                };
            }
        },

        read_note: {
            description: 'Read the contents of a note',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to the note'
                    }
                },
                required: ['path']
            },
            execute: async ({ path }: { path: string }) => {
                const file = plugin.app.vault.getAbstractFileByPath(path);
                if (!file || !(file instanceof TFile)) {
                    return { error: `Note not found: ${path}` };
                }
                const content = await plugin.app.vault.read(file);
                return { path, content };
            }
        },

        create_note: {
            description: 'Create a new note',
            parameters: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path for the new note (must end in .md)'
                    },
                    content: {
                        type: 'string',
                        description: 'Content of the note'
                    }
                },
                required: ['path', 'content']
            },
            execute: async ({ path, content }: { path: string; content: string }) => {
                const exists = await plugin.app.vault.adapter.exists(path);
                if (exists) {
                    return { error: `Note already exists: ${path}` };
                }
                await plugin.app.vault.create(path, content);
                return { success: true, path };
            }
        },

        list_notes: {
            description: 'List all notes in a folder',
            parameters: {
                type: 'object',
                properties: {
                    folder: {
                        type: 'string',
                        description: 'Folder path (empty string for root)'
                    }
                }
            },
            execute: async ({ folder = '' }: { folder?: string }) => {
                const files = plugin.app.vault.getMarkdownFiles();
                const filtered = folder
                    ? files.filter(f => f.path.startsWith(folder))
                    : files;

                return {
                    files: filtered.map(f => ({
                        path: f.path,
                        name: f.basename,
                        folder: f.parent?.path || ''
                    })),
                    count: filtered.length
                };
            }
        }
    };
}
```

**Update agent initialization in src/index.ts:**

```typescript
import { createVaultFunctions } from '~/functions/vault';

initializeAgents(plugin: ObsidianAgentsServer): Agent[] {
    const agents = []
    const vaultFunctions = createVaultFunctions(plugin);

    for (const agent of plugin.settings.agents) {
        const modelProvider = this.modelProviders.find(mp => mp.id === agent.modelProvider)
        if (!modelProvider?.instance) continue
        const model = aisdk(modelProvider.instance(agent.model))
        agents.push(
            new Agent({
                name: agent.name,
                instructions: agent.instructions,
                model,
                functions: Object.values(vaultFunctions), // ADD THIS
            })
        )
    }
    return agents
}
```

---

### Setup & Configuration

**Project Structure**
- [x] Create folder structure (agents/, models/, providers/, settings/)
- [x] Initialize TypeScript configuration
- [x] Set up build system (Vite)

**Dependencies**
```bash
# Already installed:
@openai/agents @openai/agents-extensions
@ai-sdk/openai-compatible
hono @hono/node-server
nanoid zod

# Still needed:
ws better-sqlite3
npm install --save-dev @types/ws @types/better-sqlite3
```

**Device ID System**
- [x] Generate UUID on first install (src/index.ts:61)
- [x] Create settings UI for device ID display/copy (src/settings/general/index.tsx:38-54)
- [x] Create input field for control device ID (src/settings/general/index.tsx:59-74)
- [x] Add computed property: isControlDevice (src/index.ts:66)
- [ ] Add status indicator showing control/client mode (in settings UI)

---

### Core Agent System

**Model Providers**
- [x] Create ModelProvider base class (src/providers/index.ts)
- [x] Implement LMStudio provider (src/providers/lmstudio.ts)
- [x] Configure OpenAI-compatible client pointing to localhost:1234
- [x] Fetch models from provider on initialization
- [ ] Add Ollama provider implementation

**Agent Configuration**
- [x] Agent types and interfaces (src/agents/types.ts)
- [x] Agent settings UI with full CRUD (src/agents/settings.tsx)
- [x] Agent initialization in plugin (src/index.ts:75-89)
- [x] Link agents to model providers

**Agent Functions (NOT YET IMPLEMENTED)**
- [ ] Create src/functions/ folder
- [ ] Implement journal functions (create_today, log_info)
- [ ] Implement search_notes function
- [ ] Implement util_create_file function
- [ ] Implement util_edit_file function
- [ ] Implement util_list_files function
- [ ] Implement util_update_frontmatter function
- [ ] Implement util_get_datetime function
- [ ] Implement fetch_plugin_docs function

**Agent Definitions (NOT YET IMPLEMENTED)**
- [ ] Create Journal Agent with functions
- [ ] Create System Builder Agent with functions
- [ ] Create Orchestrator Agent with handoffs
- [ ] Test standalone agents
- [ ] Test multi-agent workflows

---

### REST API

**Server Setup**
- [x] Initialize Hono server (src/index.ts:106-143)
- [x] Configure CORS (src/index.ts:110)
- [ ] Actually start the server with @hono/node-server
- [ ] Bind to 0.0.0.0 (network access)
- [ ] Add server port configuration to settings
- [ ] Add server status indicator in settings
- [ ] Add request logging middleware

**Endpoints**
- [x] GET /v1/models (list agents) (src/index.ts:112-126)
- [ ] POST /v1/chat/completions - INCOMPLETE (src/index.ts:128-141)
  - [ ] Extract model and messages from body
  - [ ] Find agent by name
  - [ ] Handle streaming vs non-streaming
  - [ ] Run agent with messages
  - [ ] Format response in OpenAI format
  - [ ] Return proper error responses
- [ ] GET /v1/status (health check)
- [ ] POST /v1/tools/:toolName (direct tool calls)
- [ ] GET /v1/sessions (list sessions)
- [ ] GET /v1/sessions/:id (session details)
- [ ] DELETE /v1/sessions/:id (clear session)

**Request Queue**
- [ ] Implement FIFO queue for concurrent requests
- [ ] Add queue status to /v1/status endpoint
- [ ] Set max queue size (reject if exceeded)

---

### Session Management

**Database Setup**
- [ ] Install better-sqlite3
- [ ] Create src/services/session-manager.ts
- [ ] Initialize SQLite database (sessions.db in plugin data folder)
- [ ] Create sessions table schema
- [ ] Create messages table schema

**Session Manager**
- [ ] Create SessionManager class
- [ ] Implement createSession(deviceId, agent)
- [ ] Implement loadSession(id)
- [ ] Implement appendMessage(sessionId, message)
- [ ] Implement persistSession(session)
- [ ] Implement cleanupOldSessions() (>7 days inactive)

**API Integration**
- [ ] Extract/generate session ID from request headers
- [ ] Load session before processing query
- [ ] Pass session history to agent
- [ ] Save session after response
- [ ] Return session ID in response headers

---

### WebSocket Server

**Server Setup**
- [ ] Install ws package
- [ ] Create src/services/websocket-server.ts
- [ ] Initialize WebSocket server on port 8002
- [ ] Track connected clients Map<deviceId, WebSocket>
- [ ] Handle client connect/disconnect
- [ ] Handle reconnection logic
- [ ] Add websocket port to settings

**Notifications (Phase 1: Completion Summaries Only)**
- [ ] Send completion_summary after agent finishes
- [ ] Include filesModified, filesCreated, summary
- [ ] Send error notifications on failures
- [ ] Add session ID to all messages
- [ ] Broadcast to all connected clients or specific device

---

### Error Handling

**Server-Level Error Handling**
- [x] Try/catch in chat completions endpoint (src/index.ts:129-140)
- [ ] Add global error handler for Hono
- [ ] Add process-level uncaughtException handler
- [ ] Add process-level unhandledRejection handler
- [ ] WebSocket error handler

**LM Studio Health Monitoring**
- [ ] Create src/services/health-monitor.ts
- [ ] Implement periodic health check (every 10s)
- [ ] Check /v1/models endpoint on each provider
- [ ] Track health status per provider
- [ ] Add isHealthy() method to ModelProvider
- [ ] Block agent requests if provider unhealthy
- [ ] Return clear errors to clients

**Request-Level Error Handling**
- [ ] Add error middleware to Hono
- [ ] Return structured error responses (OpenAI format)
- [ ] Log errors with context (timestamp, endpoint, body)
- [ ] Never crash server on error

**Timeout Protection**
- [ ] Add 60s timeout wrapper for agent.run()
- [ ] Return timeout error to client
- [ ] Continue server operation
- [ ] Log timeout events

---

### Client Setup

**MacBook OWUI**
- [ ] Configure OpenAI connection
- [ ] Base URL: http://mac-studio-ip:8001/v1
- [ ] Test basic query
- [ ] Test multi-turn conversation
- [ ] Verify session persistence

**Phone Client**
- [ ] Install OWUI or other client
- [ ] Configure connection
- [ ] Test basic query
- [ ] Test simultaneous conversations with MacBook

**Client Plugin (MacBook Obsidian)**
- [ ] Create companion plugin
- [ ] WebSocket connection to Mac Studio
- [ ] Display completion notifications
- [ ] Show connected device status
- [ ] Settings: Mac Studio URL configuration

---

### Testing

**Agent Tests**
- [ ] Journal agent: Log task
- [ ] Journal agent: Create daily note
- [ ] System builder: Fetch plugin docs
- [ ] System builder: Create file
- [ ] Orchestrator: Route to correct agent
- [ ] Multi-agent: Complex query involving both agents

**API Tests**
- [ ] Chat completions endpoint
- [ ] Session creation and persistence
- [ ] Concurrent requests (queue)
- [ ] Error handling (LM Studio down)
- [ ] Timeout handling

**Integration Tests**
- [ ] OWUI → API → Agent → Response
- [ ] Phone → API → Agent → Response
- [ ] Multiple devices simultaneously
- [ ] Session continuity across requests
- [ ] WebSocket notifications received

**Stress Tests**
- [ ] 10 concurrent requests
- [ ] Long conversation (50+ messages)
- [ ] Large file operations
- [ ] Plugin docs fetching (all 38 enabled plugins)

---

## Vault Systems to Build (Example Workflows)

### Goal Tracking System

**Conversation with System Builder Agent:**
```
User: "I want to set up a goal tracking system"

Agent: "Great! Let me help you design this. A few questions:

1. What types of goals do you want to track?
   - Personal goals (fitness, learning, habits)
   - Professional goals (career, skills, projects)
   - Long-term life goals (1-5 years)
   - All of the above?

2. How do you want to organize them?
   - By time horizon (daily, weekly, monthly, yearly)
   - By category (health, career, relationships, etc.)
   - By status (active, completed, abandoned)

3. What tracking data matters to you?
   - Progress percentage
   - Milestones/checkpoints
   - Daily check-ins
   - Metrics (e.g., weight, savings, hours spent)

4. Which plugins should we use?
   - I can see you have: dataview, obsidian-tasks-plugin, metadata-menu, obsidian-projects
   - Let me research their capabilities..."

[Agent fetches plugin docs]

Agent: "Based on the plugin capabilities, here's what I recommend:

**Folder Structure:**
Goals/
├── Active/
├── Completed/
└── Templates/

**Metadata Schema (via metadata-menu):**
fileClass: Goal
Fields:
- category: [Health, Career, Finance, Learning, Relationships]
- timeHorizon: [Daily, Weekly, Monthly, Quarterly, Yearly]
- status: [Not Started, In Progress, Completed, Abandoned]
- progress: number (0-100)
- startDate: date
- targetDate: date
- metrics: text

**Template (via templater):**
```yaml
---
fileClass: Goal
category:
timeHorizon:
status: Not Started
progress: 0
startDate: <% tp.date.now("YYYY-MM-DD") %>
targetDate:
tags: [goal]
---

# <% tp.file.title %>

## Why This Goal?

## Success Criteria

## Action Steps
- [ ]

## Progress Log

### <% tp.date.now("YYYY-MM-DD") %>
-
```

**Dataview Queries:**
- Active goals dashboard
- Goals by category
- Overdue goals

Should I create these files and set this up for you?"

User: "Yes, create it"

[Agent creates folder structure, template, example goal file]
[Agent sends WebSocket notification: "Goal tracking system created"]

User (on MacBook): Receives notification, opens Goals/ folder, sees new system

### Finance Management System

**Similar workflow:**
1. Agent asks questions about tracking needs
2. Researches relevant plugins
3. Designs folder structure, metadata schema, templates
4. Creates files
5. Documents how to use it

---

## Settings UI

```typescript
class AgentServerSettingTab extends PluginSettingTab {
    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        // Device ID Section
        containerEl.createEl('h2', { text: 'Device Configuration' });

        new Setting(containerEl)
            .setName('This Device ID')
            .setDesc('Copy this ID to designate this device as the control device')
            .addText(text => text
                .setValue(this.plugin.settings.deviceId)
                .setDisabled(true)
            )
            .addButton(button => button
                .setButtonText('Copy')
                .onClick(() => {
                    navigator.clipboard.writeText(this.plugin.settings.deviceId);
                    new Notice('Device ID copied to clipboard');
                })
            );

        new Setting(containerEl)
            .setName('Control Device ID')
            .setDesc('Paste the device ID of your Mac Studio here')
            .addText(text => text
                .setPlaceholder('Paste device ID')
                .setValue(this.plugin.settings.controlDeviceId)
                .onChange(async (value) => {
                    this.plugin.settings.controlDeviceId = value;
                    await this.plugin.saveSettings();
                    this.display(); // Refresh to show status
                })
            );

        // Status indicator
        if (this.plugin.settings.isControlDevice) {
            containerEl.createEl('p', {
                text: '✅ This is the control device (servers will start)',
                cls: 'agent-status-control'
            });
        } else if (this.plugin.settings.controlDeviceId) {
            containerEl.createEl('p', {
                text: '📱 This is a client device (connected to control device)',
                cls: 'agent-status-client'
            });
        } else {
            containerEl.createEl('p', {
                text: '⚠️ Control device not configured',
                cls: 'agent-status-unconfigured'
            });
        }

        // Server Configuration (only show if control device)
        if (this.plugin.settings.isControlDevice) {
            containerEl.createEl('h2', { text: 'Server Configuration' });

            new Setting(containerEl)
                .setName('REST API Port')
                .setDesc('Port for REST API (default: 8001)')
                .addText(text => text
                    .setValue(String(this.plugin.settings.serverPort))
                    .onChange(async (value) => {
                        this.plugin.settings.serverPort = parseInt(value) || 8001;
                        await this.plugin.saveSettings();
                    })
                );

            new Setting(containerEl)
                .setName('WebSocket Port')
                .setDesc('Port for WebSocket notifications (default: 8002)')
                .addText(text => text
                    .setValue(String(this.plugin.settings.websocketPort))
                    .onChange(async (value) => {
                        this.plugin.settings.websocketPort = parseInt(value) || 8002;
                        await this.plugin.saveSettings();
                    })
                );

            // Plugin Documentation
            containerEl.createEl('h2', { text: 'Plugin Documentation' });

            new Setting(containerEl)
                .setName('Fetch Docs on Startup')
                .setDesc('Automatically fetch plugin docs when plugin loads')
                .addToggle(toggle => toggle
                    .setValue(this.plugin.settings.fetchDocsOnStartup)
                    .onChange(async (value) => {
                        this.plugin.settings.fetchDocsOnStartup = value;
                        await this.plugin.saveSettings();
                    })
                );

            new Setting(containerEl)
                .setName('Plugins to Index')
                .setDesc('Select which plugins to fetch documentation for')
                .addButton(button => button
                    .setButtonText('Configure')
                    .onClick(() => {
                        new PluginSelectionModal(this.app, this.plugin).open();
                    })
                );

            new Setting(containerEl)
                .setName('Clear Plugin Docs Cache')
                .setDesc('Remove all cached plugin documentation')
                .addButton(button => button
                    .setButtonText('Clear Cache')
                    .onClick(async () => {
                        this.plugin.settings.pluginDocsCache = {};
                        await this.plugin.saveSettings();
                        new Notice('Plugin docs cache cleared');
                    })
                );
        }

        // Client Configuration (only show if client device)
        if (!this.plugin.settings.isControlDevice && this.plugin.settings.controlDeviceId) {
            containerEl.createEl('h2', { text: 'Client Configuration' });

            new Setting(containerEl)
                .setName('Mac Studio URL')
                .setDesc('URL of Mac Studio control device')
                .addText(text => text
                    .setPlaceholder('ws://192.168.1.x:8002')
                    .setValue(this.plugin.settings.macStudioUrl || '')
                    .onChange(async (value) => {
                        this.plugin.settings.macStudioUrl = value;
                        await this.plugin.saveSettings();
                    })
                );
        }
    }
}
```

---

## Success Criteria

Phase 1 is complete when:

- [ ] Mac Studio plugin starts without errors
- [ ] REST API accessible from MacBook and phone
- [ ] Journal agent can log tasks and create daily notes
- [ ] System Builder agent can fetch plugin docs
- [ ] System Builder agent can create files and edit frontmatter
- [ ] Orchestrator correctly routes queries to appropriate agent
- [ ] Sessions persist across requests
- [ ] Multiple devices can maintain separate conversations simultaneously
- [ ] WebSocket notifications received on clients
- [ ] Can build at least 2 vault systems with System Builder agent assistance
- [ ] No crashes after 100 queries
- [ ] LM Studio health monitoring works
- [ ] Error handling prevents server crashes

---

## Next: Phase 2

Once Phase 1 is complete and stable, Phase 2 will focus on:
- Augmenting System Builder Agent with vector search (Qdrant)
- Building remaining vault systems with enhanced agent
- Adding image/video/PDF support
- Enhanced WebSocket notifications (progress, status, errors)
- Settings integration for notification types
