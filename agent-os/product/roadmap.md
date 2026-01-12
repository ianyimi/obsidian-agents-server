# Product Roadmap

## Phase 0: Immediate Priority

1. [ ] Conversation History & Sessions — Implement persistent conversation storage per agent using SQLite. Enable session management, conversation history viewing, context window management, and conversation export. `M`

2. [ ] **LM Studio Context Compaction** — Implement automatic context window management for local models with conversation summarization, intelligent message pruning, and token-aware compaction. Leverage session history to maintain conversation coherence while staying within model context limits. `M`

3. [ ] **Obsidian LiveSync Integration** — Enable multi-device setup where one machine runs the server and others sync configuration. Implement config change detection, automatic plugin restart on config updates, and LiveSync protocol integration. Support distributed vault architecture with central server model. `L`

4. [ ] WebSocket Notification System — Implement real-time notifications to connected clients for agent completion events, long-running task updates, and vault file changes. Enable multi-device monitoring. Support LiveSync integration for config change propagation. `M`

5. [ ] Vector Search Foundation — Integrate vector database (Qdrant or Chroma) for semantic search capabilities. Implement document embeddings, similarity search API, and vault content indexing with user-configurable folders. `L`

6. [ ] Multi-Modal Processing — Add support for image analysis (OCR, description), PDF text extraction, and audio transcription. Create vault tools for processing multimedia content and generating structured outputs. `L`

7. [ ] Semantic Vault Search Tool — Build vault tool that leverages vector search for conceptual queries. Enable "find notes about deadlines" style queries that surface relevant content regardless of exact keyword matches. `M`

8. [ ] Advanced Agent Composition — Enhance agent-as-tool system with automatic capability description generation, agent output formatting controls, and hierarchical agent workflows with conditional routing. `M`

## Phase 1: Extended Features

9. [ ] Enhanced Vault Tools — Expand vault tool capabilities with file search by frontmatter, batch operations, metadata extraction, folder creation, and file rename/move operations. Enable agents to manage complex vault structures. `M`

10. [ ] Custom Tool System — Build UI for users to define custom tools via JavaScript functions or shell commands. Enable tool registration, parameter validation via Zod schemas, and execution sandboxing for safety. `L`

11. [ ] Agent Templates Library — Create pre-configured agent templates (Research Assistant, Daily Journal, Task Manager, Writing Coach) with recommended instructions, tools, and model selections. Enable one-click agent creation from templates. `S`

## Phase 2: Polish & Optimization

12. [ ] **Obsidian Sync Integration** — Add support for Obsidian's official sync service to enable cross-device configuration synchronization. Implement compatibility with both LiveSync and Obsidian Sync for maximum flexibility. `M`

13. [ ] MCP Server Marketplace Integration — Build discovery UI for popular MCP servers with installation instructions, compatibility checking, and automated setup for common servers (Context7, Ref, Brave Search). `M`

14. [ ] Agent Execution Monitoring — Add logging and monitoring for agent executions with detailed tool call traces, error tracking, performance metrics, and execution history view in settings UI. `S`

15. [ ] Agent Performance Optimization — Optimize tool execution caching, implement streaming improvements for large responses, add request queuing for concurrent API calls, and fine-tune model context management. `S`

> Notes
> - **Phase 0** focuses on intelligent features (vector search, multi-modal, advanced composition), local model support (context compaction), and essential infrastructure (sessions, LiveSync integration, WebSocket for sync support)
> - **Phase 1** adds core extensibility (enhanced tools, custom tools, templates)
> - **Phase 2** adds polish, optimization, monitoring, and additional sync options (Obsidian Sync, MCP marketplace)
> - LiveSync integration enables distributed architecture: one server device + multiple client devices syncing configuration
> - Context compaction leverages session history to enable better LM Studio model support with automatic window management
> - WebSocket system supports real-time config propagation for LiveSync integration
> - Each item represents complete, testable functionality from backend implementation through UI integration
