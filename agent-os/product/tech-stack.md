# Tech Stack

## Framework & Runtime
- **Application Framework:** Obsidian Plugin (TypeScript-based)
- **Language/Runtime:** TypeScript 4.7.4 compiled to JavaScript, Node.js 16+ for development
- **Package Manager:** npm (required by Obsidian plugin ecosystem)
- **Bundler:** esbuild 0.17.3 (fast compilation, production bundling)

## Frontend
- **UI Framework:** Obsidian Plugin API (native Obsidian UI components)
- **JavaScript Framework:** Vanilla TypeScript (no external framework, Obsidian API provides abstractions)
- **CSS:** Custom styles.css (Obsidian-compatible styling)
- **UI Components:** Obsidian built-in components (Modal, SettingTab, Notice, etc.)

## Backend / Server
- **API Server:** Express.js (REST API on port 8001)
- **WebSocket Server:** ws library (real-time notifications on port 8002)
- **Agent Framework:** OpenAI Agents SDK (@openai/agents) with custom agent definitions
- **LLM Client:** OpenAI SDK configured for LM Studio (localhost:1234)
- **Session Storage:** better-sqlite3 (persistent session database)

## Database & Storage
- **Database:** SQLite via better-sqlite3 (sessions, conversation history, metadata)
- **Vector Database:** Qdrant (semantic search, embeddings storage)
- **Caching:**
  - In-memory caching for plugin docs URLs
  - Qdrant for vector cache
  - File system cache for generated embeddings

## AI & Machine Learning
- **LLM Hosting:** LM Studio (local model serving)
- **Models:**
  - qwen3-30b (Orchestrator agent, ~20GB VRAM)
  - qwen3-8b (Specialist agents, ~10GB VRAM)
  - nomic-embed-text (Embeddings generation for vector search)
- **Vector Search:** Qdrant Vector Database (localhost:6333)
- **Embeddings Client:** @qdrant/js-client-rest

## Multi-Modal Processing
- **Image Processing:** sharp (image manipulation, resizing)
- **OCR:** tesseract.js (text extraction from images)
- **PDF Processing:** pdf-parse (PDF text extraction, metadata)
- **Video Processing:** ffmpeg (frame extraction, transcription)
- **Vision Models:** Integration points for GPT-4V, LLaVA, or similar (image description, tagging)

## Testing & Quality
- **Test Framework:** Not yet implemented (planned: Jest for unit tests)
- **Linting:** ESLint with TypeScript plugin (@typescript-eslint/eslint-plugin 5.29.0)
- **Type Checking:** TypeScript compiler with strict mode
- **Code Formatting:** ESLint (standards defined in .eslintrc)

## Deployment & Infrastructure
- **Hosting:** Self-hosted on Mac Studio (control device)
- **Network:** Local network access (0.0.0.0 binding for multi-device connectivity)
- **Deployment:** Manual installation to Obsidian plugin directory
- **CI/CD:** Not yet implemented (manual build via npm scripts)
- **Monitoring:** Custom health check endpoints, LM Studio status monitoring

## Third-Party Services
- **Authentication:** Device ID-based (UUID generation, no external auth)
- **Sync:** Obsidian LiveSync plugin (vault synchronization across devices)
- **API Integrations:**
  - Plugin documentation fetching (GitHub, plugin manifests)
  - Optional image generation APIs (DALL-E, Stable Diffusion)
  - Future: Voice APIs (OpenAI Realtime API, STT/TTS services)

## Development Tools
- **Build System:** npm scripts with esbuild configuration
- **Version Management:** Manual versioning via manifest.json and versions.json
- **Development Mode:** esbuild watch mode (npm run dev)
- **Type Definitions:**
  - @types/node 16.11.6
  - obsidian (latest - official Obsidian API types)
  - @types/express
  - @types/ws
  - @types/better-sqlite3

## Dependencies (Production)
```json
{
  "@openai/agents": "latest",
  "openai": "latest",
  "ws": "latest",
  "express": "latest",
  "cors": "latest",
  "better-sqlite3": "latest",
  "@qdrant/js-client-rest": "latest",
  "sharp": "latest",
  "tesseract.js": "latest",
  "pdf-parse": "latest"
}
```

## Dependencies (Development)
```json
{
  "@types/node": "^16.11.6",
  "@typescript-eslint/eslint-plugin": "5.29.0",
  "@typescript-eslint/parser": "5.29.0",
  "builtin-modules": "3.3.0",
  "esbuild": "0.17.3",
  "obsidian": "latest",
  "tslib": "2.4.0",
  "typescript": "4.7.4"
}
```

## Architecture Components

### Control Device (Mac Studio)
- **Obsidian Plugin:** Main server plugin with all agent logic
- **LM Studio:** Local LLM serving (qwen3 models)
- **Qdrant:** Vector database (Docker or native installation)
- **Network Services:** REST API (8001), WebSocket (8002), Qdrant (6333), LM Studio (1234)

### Client Devices (MacBook, Phone, etc.)
- **Client Plugin:** Optional lightweight plugin for WebSocket notifications
- **OWUI:** OpenAI-compatible UI for chat interface
- **Mobile Apps:** Any OpenAI-compatible mobile client
- **Browser:** Web-based interfaces connecting to REST API

## File Structure
```
obsidian-agents-server/
├── main.ts                          # Plugin entry point
├── manifest.json                    # Plugin manifest
├── package.json                     # npm dependencies
├── tsconfig.json                    # TypeScript configuration
├── esbuild.config.mjs              # Build configuration
├── .eslintrc                       # Linting rules
│
├── src/
│   ├── agents/
│   │   ├── orchestrator.ts         # Orchestrator agent
│   │   ├── journal-agent.ts        # Journal specialist
│   │   └── system-builder-agent.ts # System builder specialist
│   │
│   ├── api/
│   │   ├── rest-server.ts          # Express REST API
│   │   ├── websocket-server.ts     # WebSocket server
│   │   ├── routes.ts               # API route handlers
│   │   └── middleware.ts           # CORS, auth, error handling
│   │
│   ├── functions/
│   │   ├── journals.ts             # Journal functions
│   │   ├── search.ts               # Search functions
│   │   ├── util.ts                 # Utility functions
│   │   ├── plugin-docs.ts          # Plugin docs fetching
│   │   ├── vector-search.ts        # Vector search functions
│   │   └── media-processing.ts     # Image/PDF/video processing
│   │
│   ├── services/
│   │   ├── lm-studio-client.ts     # LM Studio connection
│   │   ├── health-monitor.ts       # Health checks
│   │   ├── request-queue.ts        # Request queue manager
│   │   ├── session-manager.ts      # SQLite session storage
│   │   ├── device-manager.ts       # Device ID management
│   │   ├── vector-service.ts       # Qdrant integration
│   │   └── vectorization.ts        # Embedding generation
│   │
│   ├── models/
│   │   └── types.ts                # TypeScript interfaces
│   │
│   └── ui/
│       └── settings-tab.ts         # Settings UI
│
├── data/
│   ├── sessions.db                 # SQLite session database
│   └── plugin-docs-cache.json      # Cached plugin docs
│
└── agent-os/
    └── product/
        ├── mission.md              # Product vision
        ├── roadmap.md              # Development roadmap
        └── tech-stack.md           # This file
```

## Platform Support
- **Desktop:** macOS (primary), Windows, Linux (Obsidian desktop app)
- **Mobile:** iOS, Android (Obsidian mobile app as client only)
- **Control Device:** macOS (Mac Studio with sufficient VRAM for LLMs)

## Performance Considerations
- **Model VRAM Requirements:** 30GB+ total for concurrent operation (20GB + 10GB)
- **Vector Search Latency:** Target <500ms for semantic queries
- **API Response Time:** Target <5s for simple queries, <30s for complex multi-agent workflows
- **Session Storage:** SQLite chosen for simplicity, reliability, and adequate performance for session use case
- **Concurrent Requests:** FIFO queue prevents LM Studio overload, max queue size configurable

## Security & Privacy
- **Network Exposure:** Local network only (no external internet exposure)
- **Authentication:** Device ID-based (UUID), no passwords or external auth
- **Data Storage:** All data local (vault, sessions, embeddings)
- **Model Hosting:** Local LLMs via LM Studio (no cloud API calls)
- **Plugin Permissions:** Full vault access (required for agent functionality)
- **Future Enhancements:** Optional end-to-end encryption for sensitive notes, encrypted vector storage

## Scalability Considerations
- **Vault Size:** Vector indexing designed for 1000+ notes
- **Session Management:** Auto-cleanup of sessions inactive >7 days
- **Vector Database:** Qdrant handles millions of vectors, far exceeding typical vault size
- **API Concurrency:** Queue-based approach scales to dozens of concurrent clients
- **Model Performance:** Limited by Mac Studio GPU, not software architecture
