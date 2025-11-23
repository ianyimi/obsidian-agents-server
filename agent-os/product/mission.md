# Product Mission

## Pitch
Obsidian Agents Server is an intelligent multi-agent platform that transforms Obsidian into an AI-powered knowledge management system. It helps knowledge workers, developers, and power users manage their digital lives by providing autonomous AI agents that understand context, assist with vault organization, and enable natural language interaction with notes across all devices.

## Users

### Primary Customers
- **Knowledge Workers**: Professionals managing complex information, projects, and personal knowledge bases
- **Developers**: Technical users building and maintaining sophisticated note-taking systems
- **Power Users**: Advanced Obsidian users seeking automation and AI-enhanced workflows
- **Content Creators**: Writers, researchers, and creators organizing large volumes of information

### User Personas

**Alex, the Productivity Engineer** (28-45)
- **Role:** Software engineer, product manager, or technical consultant
- **Context:** Maintains extensive documentation across multiple projects, manages daily notes, tracks goals and habits
- **Pain Points:** Manually organizing notes is time-consuming, searching for information is inefficient, repeating similar vault structures for different systems, switching between devices interrupts workflow
- **Goals:** Seamless multi-device access, intelligent search and retrieval, automated note organization, voice-based capture while mobile

**Sam, the Knowledge Architect** (30-50)
- **Role:** Researcher, writer, or knowledge management consultant
- **Context:** Manages thousands of interconnected notes, complex taxonomies, and multiple knowledge systems
- **Pain Points:** Building new systems from scratch takes hours, difficult to maintain consistency across vault, hard to find relevant connections, scaling vault structure is challenging
- **Goals:** AI-assisted system design, semantic search across entire vault, automated metadata management, intelligent note linking

**Jordan, the Digital Nomad** (25-40)
- **Role:** Freelancer, consultant, or remote worker constantly on the move
- **Context:** Works from phone, tablet, and laptop throughout the day
- **Pain Points:** Mobile note-taking is clunky, context switching between devices loses state, can't access full vault power on mobile, voice capture would be ideal but Obsidian lacks it
- **Goals:** Full agent access from any device, persistent sessions across devices, voice-based note capture, real-time synchronization

## The Problem

### Knowledge Management at Scale is Tedious and Inefficient
Modern knowledge workers accumulate thousands of notes but spend disproportionate time on organizational overhead rather than creative work. Building new systems (goal tracking, finance, project management) requires hours of research, template creation, and structural planning. Finding information relies on remembering exact keywords rather than concepts. Obsidian's plugin ecosystem is powerful but requires significant manual configuration and lacks intelligent, context-aware assistance.

**Our Solution:** Deploy autonomous AI agents with direct vault access that understand your intent, assist with system design, manage daily operations, and provide natural language interaction. Agents run on a central server with API access from all devices, enabling seamless multi-device workflows.

### Multi-Device Workflows are Fragmented
Users want full vault functionality on phones, tablets, and multiple computers, but Obsidian's mobile experience is limited. Current solutions require separate apps, lose conversation context when switching devices, and lack the processing power for AI operations on mobile.

**Our Solution:** Centralized agent server (Mac Studio) handles all AI processing with REST and WebSocket APIs. Client devices maintain persistent sessions, receive real-time notifications, and access full agent capabilities regardless of device constraints.

### Information Retrieval Relies on Exact Matches
Traditional search requires remembering specific keywords. Users know they have relevant information but can't find it because they don't recall exact phrasing. Related notes remain siloed because connections aren't obvious.

**Our Solution:** Vector search with semantic understanding finds notes by concept, not keywords. "Notes about project deadlines" surfaces relevant content even if those exact words aren't present. Agents leverage this to provide contextual recommendations and discover hidden connections.

## Differentiators

### Direct Vault Integration with Multi-Agent Intelligence
Unlike external AI assistants or chatbots, our agents have direct programmatic access to the Obsidian vault through the plugin API. This enables atomic operations (create files, update metadata, run Dataview queries, configure plugins) rather than just providing suggestions. The orchestrator agent intelligently routes requests to specialized agents (journal, system builder), enabling sophisticated workflows without user prompt engineering.

This results in agents that truly augment your workflow rather than being disconnected advisory tools.

### Centralized Server with Universal Device Access
Unlike device-specific AI solutions, our architecture centralizes AI processing on a powerful control device (Mac Studio) while enabling lightweight client access from any device. Sessions persist across devices - start a conversation on your phone, continue on MacBook, receive completion notifications everywhere. This is impossible with traditional per-device LLM approaches due to resource constraints and context fragmentation.

This results in consistent AI capabilities regardless of which device you're using, with no compromises on model quality or context depth.

### Semantic Understanding Through Vector Search
Unlike basic keyword search, we vectorize plugin documentation and user-selected vault content using embeddings, enabling conceptual search. The System Builder Agent leverages this to understand plugin capabilities semantically, learn from your existing vault structure, and avoid duplicating functionality. Users can search their knowledge base by meaning rather than exact text matches.

This results in dramatically improved information discovery and intelligent agent assistance grounded in your actual vault content and structure.

### Agent-Assisted System Building
Unlike manual system creation, the System Builder Agent collaborates with users to design, implement, and document complete vault systems (goals tracking, finance management, entertainment libraries). It researches plugin capabilities, proposes metadata schemas, creates templates, sets up Dataview queries, and documents usage - tasks that would take hours manually.

This results in rapid deployment of sophisticated, well-structured vault systems with minimal user effort.

## Key Features

### Core Features
- **Multi-Agent Orchestration:** Central orchestrator intelligently routes requests to specialized agents (journal, system builder) with support for complex multi-agent workflows
- **REST API Access:** OpenAI-compatible API enables universal client compatibility (OWUI, custom apps, web interfaces) from any device on the network
- **Persistent Sessions:** Conversation history survives across requests, plugin reloads, and device switches with SQLite-backed session storage
- **Direct Vault Operations:** Agents have full programmatic vault access for file creation, editing, frontmatter updates, plugin configuration, and Dataview queries
- **LM Studio Integration:** Local model hosting (qwen3-30b orchestrator, qwen3-8b specialists) ensures privacy and eliminates API costs

### Collaboration Features
- **Multi-Device Support:** MacBook, phone, and other clients connect simultaneously with independent sessions and shared agent access
- **WebSocket Notifications:** Real-time completion summaries, progress updates, status messages, and file event notifications delivered to all connected clients
- **System Builder Agent:** Collaborative system design through natural language - agent asks clarifying questions, researches plugins, proposes architectures, and implements solutions
- **Session Management:** View active sessions, clear history, track session metadata, and manage device-specific preferences

### Advanced Features
- **Vector Search (Qdrant):** Semantic search across plugin documentation and user-configured vault folders enables conceptual information retrieval
- **Plugin Documentation Indexing:** Automatic vectorization of enabled plugins for intelligent capability discovery and recommendation
- **Vault Content Vectorization:** User-configurable folder indexing with automatic updates enables semantic search across your knowledge base
- **Multi-Modal Processing:** Image analysis (OCR, description, tags), image generation, PDF text extraction, and video processing (transcription, frame extraction)
- **Request Queue Management:** FIFO queue handles concurrent requests without overwhelming LM Studio, with health monitoring and graceful error handling
- **Settings-Controlled Notifications:** Granular control over notification types, per-device preferences, and delivery channels
