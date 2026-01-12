# Tech Stack

## Framework & Runtime
- **Application Framework:** Obsidian Plugin (TypeScript-based)
- **Language/Runtime:** TypeScript 4.7.4 compiled to JavaScript, Node.js 16+ for development
- **Package Manager:** pnpm 10.11.0 (preferred for dependency management and workspace support)
- **Bundler:** Vite 7.2.4 (fast HMR and production bundling)

## Frontend / UI
- **UI Framework:** React 19.2.0 with TypeScript
- **Component Library:** Radix UI (headless accessible components)
  - @radix-ui/react-accordion 1.2.12
  - @radix-ui/react-checkbox 1.3.3
  - @radix-ui/react-dialog 1.1.15
  - @radix-ui/react-label 2.1.8
  - @radix-ui/react-popover 1.1.15
  - @radix-ui/react-select 2.2.6
  - @radix-ui/react-tabs 1.1.13
- **Form Management:** TanStack React Form 1.25.0 (type-safe form handling)
- **Styling:** Tailwind CSS 3.4.18 with custom configuration
  - tailwind-merge 3.4.0 (utility merging)
  - tailwind-variants 3.2.2 (variant composition)
  - tailwindcss-animate 1.0.7 (animation utilities)
  - tailwindcss-react-aria-components 2.0.1
- **Icons:** Lucide React 0.554.0, Heroicons React 2.2.0
- **Command Palette:** cmdk 1.1.1 (command menu component)
- **CSS Utilities:** clsx 2.1.1, class-variance-authority 0.7.1

## Backend / Server
- **API Server:** Hono 4.10.6 (lightweight web framework)
- **Server Runtime:** @hono/node-server 1.19.6 (Node.js adapter for Hono)
- **Agent Framework:** OpenAI Agents SDK
  - @openai/agents 0.3.7
  - @openai/agents-extensions 0.3.7 (AI SDK extension)
- **AI SDK Integration:**
  - @ai-sdk/openai 2.0.88
  - @ai-sdk/openai-compatible 1.0.27 (for LM Studio, Ollama)
- **MCP Protocol:** @modelcontextprotocol/sdk 1.23.0 (Model Context Protocol support)

## AI & Machine Learning
- **LLM Providers:**
  - LM Studio (local model serving via OpenAI-compatible endpoint)
  - Ollama (local models via ollama-ai-provider-v2 1.5.5)
  - OpenAI-compatible endpoints (custom providers)
- **Model Interface:** AI SDK with provider adapters for unified model access
- **Tokenization:** gpt-tokenizer 3.4.0 (token counting for context management)

## Data Management
- **State Management:** TanStack React Query 5.90.11 (async state and caching)
- **Schema Validation:** Zod 3.25.76 (runtime type validation)
- **Schema Conversion:** json-schema-to-zod 2.7.0 (JSON Schema to Zod conversion)
- **Unique IDs:** nanoid 5.1.6 (compact unique ID generation)

## Development Tools
- **Build System:** Vite with custom configuration
- **TypeScript:** 4.7.4 with strict mode enabled
- **Linting:** ESLint with multiple plugins
  - typescript-eslint 8.47.0
  - @typescript-eslint/eslint-plugin 5.29.0
  - @typescript-eslint/parser 5.29.0
  - eslint-plugin-import-x 4.16.1
  - eslint-plugin-perfectionist 4.15.1
  - eslint-plugin-react-hooks 7.0.1
  - @tanstack/eslint-plugin-query 5.91.2
- **PostCSS:** 8.5.6 with Autoprefixer 10.4.22
- **Copy Plugin:** rollup-plugin-copy 3.5.0 (asset copying during build)

## Type Definitions
- **Core Types:**
  - @types/node 16.11.6
  - @types/react 19.2.6
  - @types/react-dom 19.2.3
- **Obsidian API:** obsidian (latest - official type definitions)

## Obsidian Plugin Integration
- **Plugin API:** Obsidian Plugin API for vault operations, settings, and lifecycle management
- **Supported Plugin Integrations:**
  - Templater (template-based file creation)
  - Omnisearch (semantic vault search)

## MCP Server Ecosystem
- **Transport Types:**
  - Stdio (local command execution)
  - SSE (HTTP-based server-sent events)
- **Popular MCP Servers:**
  - Context7 (@upstash/context7-mcp)
  - Ref (ref-tools-mcp)
  - Custom user-defined servers

## Architecture & Design Patterns

### Application Structure
```
obsidian-agents-server/
├── src/
│   ├── index.ts                      # Plugin entry point, main class
│   ├── agents/
│   │   ├── types.ts                  # Agent configuration types
│   │   ├── chatCompletionApiTypes.ts # OpenAI API types
│   │   └── settings/                 # Agent settings UI components
│   ├── models/
│   │   ├── providers/
│   │   │   ├── index.ts              # Base provider class
│   │   │   ├── constants.ts          # Provider definitions
│   │   │   ├── lmstudio.ts           # LM Studio provider
│   │   │   └── openai.ts             # OpenAI/compatible provider
│   │   └── settings.tsx              # Model provider settings UI
│   ├── mcp/
│   │   ├── index.ts                  # MCP manager
│   │   ├── stdio.ts                  # Stdio transport implementation
│   │   ├── sse.ts                    # SSE transport implementation
│   │   └── settings.tsx              # MCP server settings UI
│   ├── tools/
│   │   ├── vault.ts                  # Vault operation tools
│   │   ├── types.ts                  # Tool type definitions
│   │   └── plugin-utils.ts           # Plugin integration utilities
│   ├── settings/
│   │   ├── index.tsx                 # Main settings tab
│   │   ├── types.ts                  # Settings types
│   │   └── general/                  # General settings UI
│   ├── components/
│   │   ├── ui/                       # Reusable UI components
│   │   └── form/                     # Form field components
│   └── lib/
│       ├── utils.ts                  # Utility functions
│       └── primitive.ts              # UI primitives
├── agent-os/
│   └── product/                      # Product documentation
│       ├── mission.md
│       ├── roadmap.md
│       └── tech-stack.md
├── dist/                             # Build output
├── package.json                      # Dependencies and scripts
├── manifest.json                     # Obsidian plugin manifest
├── tsconfig.json                     # TypeScript configuration
├── vite.config.js                    # Vite build configuration
└── tailwind.config.js                # Tailwind CSS configuration
```

### Key Design Patterns
- **Plugin Pattern:** Obsidian Plugin class extends base plugin with lifecycle hooks (onload, onunload)
- **Provider Pattern:** Model providers implement common interface for LLM connections
- **Tool Pattern:** Tools define schema, description, and execute function via OpenAI Agents SDK
- **Manager Pattern:** MCPManager handles lifecycle of multiple MCP server connections
- **Composition Pattern:** Agents can include other agents as tools via Agent.asTool()
- **Settings Pattern:** React components for settings UI integrated with Obsidian SettingTab

### API Architecture
- **REST Endpoints:**
  - `GET /v1/models` - List enabled agents as "models"
  - `POST /v1/chat/completions` - Send messages to agents (streaming or non-streaming)
- **OpenAI Compatibility:** Full compliance with OpenAI Chat Completions API format
- **Streaming:** Server-Sent Events (SSE) for real-time responses with tool execution visibility
- **CORS:** Enabled for cross-origin requests from web clients

## Dependencies (Production)

### Core Framework
```json
{
  "obsidian": "latest",
  "react": "^19.2.0",
  "react-dom": "^19.2.0"
}
```

### Server & API
```json
{
  "hono": "^4.10.6",
  "@hono/node-server": "^1.19.6"
}
```

### AI & Agents
```json
{
  "@openai/agents": "^0.3.7",
  "@openai/agents-extensions": "^0.3.7",
  "@ai-sdk/openai": "^2.0.88",
  "@ai-sdk/openai-compatible": "^1.0.27",
  "ollama-ai-provider-v2": "^1.5.5",
  "@modelcontextprotocol/sdk": "^1.23.0",
  "gpt-tokenizer": "^3.4.0"
}
```

### UI Components
```json
{
  "@radix-ui/react-accordion": "^1.2.12",
  "@radix-ui/react-checkbox": "^1.3.3",
  "@radix-ui/react-dialog": "^1.1.15",
  "@radix-ui/react-label": "^2.1.8",
  "@radix-ui/react-popover": "^1.1.15",
  "@radix-ui/react-select": "^2.2.6",
  "@radix-ui/react-slot": "^1.2.4",
  "@radix-ui/react-tabs": "^1.1.13",
  "@heroicons/react": "^2.2.0",
  "lucide-react": "^0.554.0",
  "cmdk": "^1.1.1",
  "react-aria-components": "^1.13.0"
}
```

### State & Data
```json
{
  "@tanstack/react-form": "^1.25.0",
  "@tanstack/react-query": "^5.90.11",
  "zod": "^3.25.76",
  "json-schema-to-zod": "^2.7.0",
  "nanoid": "^5.1.6"
}
```

### Styling
```json
{
  "tailwindcss": "^3.4.18",
  "tailwind-merge": "^3.4.0",
  "tailwind-variants": "^3.2.2",
  "tailwindcss-animate": "^1.0.7",
  "tailwindcss-react-aria-components": "^2.0.1",
  "tw-animate-css": "^1.4.0",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1"
}
```

## Dependencies (Development)

```json
{
  "@types/node": "^16.11.6",
  "@types/react": "^19.2.6",
  "@types/react-dom": "^19.2.3",
  "@typescript-eslint/eslint-plugin": "5.29.0",
  "@typescript-eslint/parser": "5.29.0",
  "@eslint/eslintrc": "^3.3.1",
  "@tanstack/eslint-plugin-query": "^5.91.2",
  "eslint-plugin-import-x": "^4.16.1",
  "eslint-plugin-perfectionist": "^4.15.1",
  "eslint-plugin-react-hooks": "^7.0.1",
  "typescript-eslint": "^8.47.0",
  "autoprefixer": "^10.4.22",
  "builtin-modules": "3.3.0",
  "esbuild": "0.17.3",
  "obsidian": "latest",
  "postcss": "^8.5.6",
  "rollup-plugin-copy": "^3.5.0",
  "tailwindcss": "^3.4.18",
  "tslib": "2.4.0",
  "typescript": "4.7.4",
  "vite": "^7.2.4"
}
```

## Build & Deployment

### Build Scripts
- `pnpm dev` - Development mode with watch and HMR
- `pnpm build` - Production build
- `pnpm release` - Semantic release automation

### Build Process
1. Vite compiles TypeScript and React
2. Tailwind CSS processes styles
3. Assets copied to dist/
4. Output: main.js, styles.css for Obsidian plugin

### Deployment
- **Manual:** Copy main.js, manifest.json, styles.css to vault plugin folder
- **BRAT:** Install via Beta Reviewers Auto-update Tester plugin
- **Future:** Obsidian Community Plugin Directory (pending approval)

## Platform Support
- **Desktop:** macOS, Windows, Linux (Obsidian desktop app)
- **Mobile:** iOS, Android (Obsidian mobile app - API client only)
- **API Clients:** Any device with network access to server port

## Performance Considerations
- **Server Startup:** Agents initialize on plugin load, ~1-2s for multiple agents
- **API Response Time:** Depends on model speed, typically 1-10s for simple queries
- **Streaming:** Real-time token streaming reduces perceived latency
- **Tool Execution:** Vault operations are near-instant (<100ms)
- **MCP Connections:** Stdio servers start on-demand, SSE servers require active endpoint
- **Memory:** Agent instances and model connections held in memory during plugin lifecycle

## Security & Privacy
- **Network Exposure:** Server binds to localhost by default, configurable for LAN access
- **Authentication:** None (local network trust model), optional Device ID system for future
- **Data Storage:** All settings and agent configurations stored in Obsidian plugin data
- **Model Hosting:** Supports fully local LLMs (LM Studio, Ollama) - no cloud requirements
- **Plugin Permissions:** Full vault access required for agent capabilities
- **MCP Security:** Stdio servers run with plugin process permissions, SSE servers external
- **Path Controls:** Per-agent included/excluded folders for file access restrictions

## Scalability Considerations
- **Agent Count:** No hard limit, bounded by memory and model availability
- **Concurrent Requests:** OpenAI Agents SDK handles execution, no artificial limits
- **Vault Size:** Performance scales with Obsidian vault performance
- **API Throughput:** Hono server handles dozens of concurrent connections efficiently
- **Model Switching:** Different agents can use different models simultaneously
- **MCP Servers:** Multiple MCP servers can be connected and used by agents concurrently

## Future Enhancements
- **Vector Search:** Qdrant or Chroma integration for semantic search
- **Session Storage:** SQLite for persistent conversation history
- **WebSocket Notifications:** Real-time event streaming to clients
- **Custom Tools:** User-defined tools via JavaScript or shell commands
- **Agent Templates:** Pre-configured agent library for common use cases
- **Monitoring Dashboard:** Execution logs, performance metrics, error tracking
