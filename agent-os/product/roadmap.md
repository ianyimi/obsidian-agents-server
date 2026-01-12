# Product Roadmap

## Phase 0: Immediate Priority

1. [ ] **LM Studio Context Compaction** — Implement stateless automatic context window management for local models with conversation summarization, intelligent message pruning, and token-aware compaction. Process conversation history from API requests on-the-fly to maintain conversation coherence while staying within model context limits. Works with OpenWebUI and other API clients. `M`

2. [ ] **Obsidian LiveSync Integration** — Enable multi-device setup where one machine runs the server and others sync configuration. Implement config change detection, automatic plugin restart on config updates, and LiveSync protocol integration. Support distributed vault architecture with central server model. `L`

3. [ ] WebSocket Notification System — Implement real-time notifications to connected clients for agent completion events, long-running task updates, and vault file changes. Enable multi-device monitoring. Support LiveSync integration for config change propagation. `M`

4. [ ] Vector Search Foundation — Integrate vector database (Qdrant or Chroma) for semantic search capabilities. Implement document embeddings, similarity search API, and vault content indexing with user-configurable folders. `L`

5. [ ] Multi-Modal Processing — Add support for image analysis (OCR, description), PDF text extraction, and audio transcription. Create vault tools for processing multimedia content and generating structured outputs. `L`

6. [ ] Semantic Vault Search Tool — Build vault tool that leverages vector search for conceptual queries. Enable "find notes about deadlines" style queries that surface relevant content regardless of exact keyword matches. `M`

7. [ ] Advanced Agent Composition — Enhance agent-as-tool system with automatic capability description generation, agent output formatting controls, and hierarchical agent workflows with conditional routing. `M`

## Phase 1: Extended Features

8. [ ] Enhanced Vault Tools — Expand vault tool capabilities with file search by frontmatter, batch operations, metadata extraction, folder creation, and file rename/move operations. Enable agents to manage complex vault structures. `M`

9. [ ] Custom Tool System — Build UI for users to define custom tools via JavaScript functions or shell commands. Enable tool registration, parameter validation via Zod schemas, and execution sandboxing for safety. `L`

10. [ ] Agent Templates Library — Create pre-configured agent templates (Research Assistant, Daily Journal, Task Manager, Writing Coach) with recommended instructions, tools, and model selections. Enable one-click agent creation from templates. `S`

## Phase 2: Polish & Optimization

11. [ ] **In-Plugin Chat Interface** — Build native chat UI inside Obsidian for direct agent conversations. Integrate with LiveSync for cross-device chat access. Replace dependency on OpenWebUI with native experience. `L`

12. [ ] Conversation History & Sessions — Implement persistent conversation storage per agent using SQLite. Enable session management, conversation history viewing across LiveSync-connected devices, context window management, and conversation export. `M`

13. [ ] **Obsidian Sync Integration** — Add support for Obsidian's official sync service to enable cross-device configuration synchronization. Implement compatibility with both LiveSync and Obsidian Sync for maximum flexibility. `M`

14. [ ] MCP Server Marketplace Integration — Build discovery UI for popular MCP servers with installation instructions, compatibility checking, and automated setup for common servers (Context7, Ref, Brave Search). `M`

15. [ ] Agent Execution Monitoring — Add logging and monitoring for agent executions with detailed tool call traces, error tracking, performance metrics, and execution history view in settings UI. `S`

16. [ ] Agent Performance Optimization — Optimize tool execution caching, implement streaming improvements for large responses, add request queuing for concurrent API calls, and fine-tune model context management. `S`

> Notes
> - **Phase 0** focuses on intelligent features (vector search, multi-modal, advanced composition), stateless local model support (context compaction), and essential infrastructure (LiveSync integration, WebSocket for sync support)
> - **Phase 1** adds core extensibility (enhanced tools, custom tools, templates)
> - **Phase 2** adds native chat UI, persistent sessions, polish, optimization, monitoring, and additional sync options (Obsidian Sync, MCP marketplace)
> - LiveSync integration enables distributed architecture: one server device + multiple client devices syncing configuration
> - Context compaction works stateless with OpenWebUI/API clients by processing conversation history on-the-fly per request
> - WebSocket system supports real-time config propagation for LiveSync integration
> - In-plugin chat interface in Phase 2 will integrate with LiveSync for cross-device conversation access
> - Each item represents complete, testable functionality from backend implementation through UI integration
