# Product Roadmap

1. [ ] Core Agent Framework — Implement multi-agent system (Orchestrator + Journal + System Builder) with LM Studio integration, session management, and direct vault access for file operations. `L`

2. [ ] REST API Server — Build OpenAI-compatible REST API with endpoints for chat completions, session management, tool invocation, and health monitoring. Include request queue and error handling. `M`

3. [ ] WebSocket Notification System — Implement real-time notification server for completion summaries, errors, and file events. Support multiple connected clients with device-specific preferences. `M`

4. [ ] Device ID & Multi-Device Architecture — Create device identification system distinguishing control device (Mac Studio) from clients. Enable settings UI for device configuration and client-server connection management. `S`

5. [ ] Journal Agent & Core Functions — Build journal specialist agent with functions for daily note creation, quick logging, task management, and search capabilities. Integrate with vault structure and metadata. `M`

6. [ ] System Builder Agent & Plugin Documentation — Implement system builder specialist with plugin docs fetching, caching, and semantic understanding. Enable file creation, editing, and vault system design workflows. `L`

7. [ ] Client Device Setup & Testing — Configure OWUI and mobile clients to connect to agent server. Verify multi-device simultaneous access, session persistence, and notification delivery across devices. `M`

8. [ ] Vector Search Integration (Qdrant) — Deploy Qdrant vector database, implement embedding generation (nomic-embed-text), create collections for plugin docs and vault content. Enable semantic search capabilities. `L`

9. [ ] Plugin Documentation Vectorization — Build pipeline to chunk, embed, and index all enabled plugin documentation. Implement search_plugin_docs function for semantic plugin capability discovery. `M`

10. [ ] Vault Content Vectorization — Create user-configurable vault indexing with folder filtering, batch processing, auto-updates on file changes, and progress tracking. Implement search_vault_content function. `L`

11. [ ] Enhanced WebSocket Notifications — Expand notification types to include progress updates, status messages, and granular file events. Add settings control for notification preferences and per-device customization. `S`

12. [ ] Multi-Modal Processing Suite — Implement image analysis (OCR, description, tagging), image generation, PDF text extraction, and video processing (transcription, frame extraction, metadata). `L`

13. [ ] Vault System Building Workflow — Use enhanced System Builder Agent to collaboratively design and implement vault systems (goals, finance, entertainment tracking, etc.) with semantic search and user guidance. `XL`

14. [ ] Performance Optimization & Monitoring — Optimize vector search queries, implement caching strategies, tune request queue, add comprehensive error tracking and system health monitoring. `M`

15. [ ] Voice Agent Foundation (Phase 3) — Prototype voice interaction approaches (WebRTC real-time, WebSocket audio streaming, or hybrid STT/TTS). Evaluate latency, quality, and device compatibility. `XL`

> Notes
> - Roadmap follows three-phase architecture: Phase 1 (items 1-7) establishes core framework, Phase 2 (items 8-14) adds intelligence and multi-modal capabilities, Phase 3 (item 15+) enables voice and open-ended augmentation
> - Items ordered by technical dependencies: agents before APIs, APIs before clients, core search before vectorization, basic functions before advanced features
> - Each item represents end-to-end functionality: backend implementation + client integration + testing verification
> - System Builder workflows (item 13) span multiple iterations as different vault systems are built collaboratively with the agent
