# Product Mission

## Pitch
Obsidian Agents Server is a multi-agent AI framework plugin that transforms Obsidian into a programmable AI platform. It helps knowledge workers, developers, and power users augment their workflows by providing customizable AI agents with direct vault access, extensible tool systems via MCP protocol, and an OpenAI-compatible API that enables universal client compatibility across all devices.

## Users

### Primary Customers
- **Knowledge Workers**: Professionals managing complex information, projects, and personal knowledge bases who want AI assistance deeply integrated with their notes
- **Developers**: Technical users building custom AI workflows, automating vault operations, and integrating Obsidian with external tools and services
- **Power Users**: Advanced Obsidian users seeking to compose sophisticated multi-agent workflows without prompt engineering
- **AI Enthusiasts**: Users running local LLMs (LM Studio, Ollama) who want privacy-focused AI assistance without cloud dependencies

### User Personas

**Alex, the Productivity Engineer** (28-45)
- **Role:** Software engineer, product manager, or technical consultant
- **Context:** Maintains extensive documentation across multiple projects, manages daily notes, and integrates various tools into workflows
- **Pain Points:** Context switching between AI tools and Obsidian, lack of programmatic vault access from AI, vendor lock-in with OpenAI, difficulty customizing AI behavior per use case
- **Goals:** Local AI control with LM Studio/Ollama, agents that can read and write vault files, ability to use agents as building blocks in complex workflows, API access for custom integrations

**Sam, the Knowledge Architect** (30-50)
- **Role:** Researcher, writer, or knowledge management consultant
- **Context:** Manages thousands of interconnected notes with complex metadata schemas and custom workflows
- **Pain Points:** AI assistants lack understanding of vault structure, can't directly manipulate files, require copy-pasting content, don't integrate with Obsidian plugins
- **Goals:** Agents that understand vault organization, can create and modify notes programmatically, leverage existing plugins (Templater, Dataview), compose specialized agents for different tasks

**Jordan, the Local-First Advocate** (25-40)
- **Role:** Privacy-conscious professional or consultant
- **Context:** Runs local LLMs for sensitive work, avoids cloud AI services
- **Pain Points:** Most AI tools require cloud APIs, self-hosted solutions lack polish, difficult to integrate local models with Obsidian, limited tooling for local setups
- **Goals:** Complete local operation (LM Studio, Ollama), no telemetry or external calls, extensible via MCP protocol, standards-compliant API for compatibility

**Taylor, the Automation Builder** (30-50)
- **Role:** Software developer or technical operations specialist
- **Context:** Builds custom automation and integration workflows across multiple tools
- **Pain Points:** Obsidian's plugin API requires TypeScript development, AI integrations are one-off scripts, agent capabilities are siloed across different services
- **Goals:** OpenAI-compatible API to drop-in existing tools, agent composition enables complex workflows, MCP support allows connecting external services, programmatic agent configuration

## The Problem

### AI Assistants Are Disconnected from Knowledge Management Systems
Modern knowledge workers use AI extensively but experience friction at every interaction. AI tools require manual copy-pasting of context from notes, can't directly manipulate vault files, lack understanding of vault structure and metadata, and operate independently of the Obsidian plugin ecosystem. This creates a tedious workflow: read note → copy to AI → get response → manually apply changes → return to Obsidian.

**Our Solution:** Deploy AI agents directly inside Obsidian with full programmatic vault access. Agents can read files, create notes, update metadata, search content, and leverage Obsidian plugins (Templater, Omnisearch) as native capabilities. The agent server runs within the plugin, eliminating context switching entirely.

### Local AI Users Lack Production-Grade Tooling
Users running local LLMs (LM Studio, Ollama) for privacy or cost reasons face significant integration challenges. Most AI frameworks assume OpenAI API, local setups require custom code and lack polish, and extending capabilities means forking projects or writing one-off scripts. The result is a fragmented landscape where local AI power users cobble together brittle, unmaintained solutions.

**Our Solution:** First-class support for local model providers with automatic model discovery, an OpenAI-compatible API that works with existing tools (Continue, custom clients), and MCP protocol integration enabling standardized extensions without custom code. Local users get the same polished experience as cloud users.

### Multi-Agent Workflows Require Custom Development
Building sophisticated AI workflows typically requires prompt engineering expertise and custom development. Users want specialized agents (research agent, writing agent, task manager) that collaborate but must either engineer complex system prompts or build custom orchestration systems. Agent composition - using agents as building blocks - is a programming task, not a configuration task.

**Our Solution:** Agent composition as a first-class feature. Any agent can expose itself as a tool for other agents. Create a research agent, enable "use as tool," then add it to your orchestrator agent's toolkit. Agents receive custom tool names and descriptions, enabling natural delegation without prompt engineering. The orchestrator agent can automatically route requests to specialists based on capability.

### Extensibility Requires Plugin Development
Extending AI agent capabilities in Obsidian currently requires TypeScript plugin development - a high barrier to entry. Users want to connect agents to external tools (web search, databases, APIs) but lack a standardized extension mechanism. Every new capability means forking the plugin, managing dependencies, and maintaining custom builds.

**Our Solution:** Model Context Protocol (MCP) integration enables zero-code extensibility. Connect stdio servers (local commands) or SSE servers (HTTP endpoints) that expose tools via the MCP specification. Agents automatically discover available tools, and users configure which agents can access which MCP servers. This unlocks the entire MCP ecosystem (Context7, Ref, custom servers) without writing plugin code.

## Differentiators

### Direct Vault Integration with Full Programmatic Access
Unlike external AI tools or cloud services, our agents have direct access to the Obsidian vault through the plugin API. This enables atomic operations - create files with templates, update frontmatter, run Omnisearch queries, invoke Templater templates - rather than just providing suggestions. Agents understand vault structure, respect folder organization, and leverage metadata.

This results in agents that truly augment your workflow rather than being disconnected advisory tools. They don't just suggest changes - they make them.

### Agent Composition Without Prompt Engineering
Unlike monolithic AI systems, we enable hierarchical agent composition as a configuration option. Create specialized agents (research, writing, analysis), enable "use as tool" for each, then add them to an orchestrator's toolkit. The orchestrator automatically delegates based on agent descriptions and tool parameters. Users build complex workflows by composing agents, not writing intricate prompts.

This results in maintainable, modular AI systems where each agent has a clear responsibility and can be improved independently.

### Local-First with Universal API Compatibility
Unlike cloud-dependent AI tools, we provide first-class support for local LLM providers (LM Studio, Ollama) with automatic model discovery. Unlike local-only solutions, we expose an OpenAI-compatible REST API with streaming support. This means privacy-conscious users can run everything locally while still using existing tools (Continue.dev, OWUI, custom clients) designed for OpenAI.

This results in the best of both worlds: complete local control with ecosystem compatibility.

### Zero-Code Extensibility via MCP Protocol
Unlike plugins requiring TypeScript development, we support the Model Context Protocol standard. Users connect MCP servers (stdio commands or HTTP endpoints) that expose tools, and agents automatically discover and use them. This unlocks the growing MCP ecosystem (web search, databases, APIs, custom services) without custom plugin development.

This results in extensible agents that can grow capabilities by installing MCP servers, not by forking code.

### OpenAI-Compatible Multi-Agent API
Unlike proprietary agent systems, we expose agents through a standards-compliant REST API. Each agent appears as a "model" in the `/v1/models` endpoint. Clients send requests to `/v1/chat/completions` with the agent name as the model parameter. Full streaming support via Server-Sent Events enables real-time tool execution visibility.

This results in universal client compatibility - any OpenAI-compatible client can access your agents across devices and platforms.

## Key Features

### Core Features
- **Multi-Agent Framework:** Create unlimited custom agents with unique instructions, model selections, and tool configurations per agent
- **Local Model Providers:** First-class support for LM Studio and Ollama with automatic model discovery from provider endpoints
- **Agent Composition:** Agents can use other agents as tools - enable "use as tool" and configure tool names/descriptions for natural delegation
- **OpenAI-Compatible API:** REST API at `/v1/models` and `/v1/chat/completions` with full streaming support (SSE) for universal client compatibility
- **Persistent Configuration:** All agent settings, model providers, and tool configurations persist in Obsidian's plugin data

### Vault Integration Features
- **Read File:** Read file contents from any vault path with path validation against allowed/excluded folders
- **Create File:** Create new files with custom content, optional frontmatter, and timestamp control
- **Update File:** Modify existing file contents with full or partial rewrites
- **Delete File:** Remove files from vault with safety checks
- **Count Notes:** Get total markdown file count for vault metrics
- **Create From Template:** Use Templater plugin templates for structured content creation
- **Omnisearch Integration:** Leverage Omnisearch plugin for semantic vault-wide search
- **Path Controls:** Per-agent included/excluded folder paths enforce fine-grained file access restrictions

### MCP Integration Features
- **Stdio Transport:** Run local commands as MCP servers with custom arguments and environment variables
- **SSE Transport:** Connect to HTTP-based MCP servers via Server-Sent Events
- **Automatic Tool Discovery:** MCP servers expose tools via standardized protocol, agents discover them dynamically
- **Per-Agent Tool Selection:** Configure which MCP servers and specific tools each agent can access
- **Tool Caching:** Optional caching of tool lists from MCP servers for performance
- **Connection Management:** Health monitoring, automatic reconnection, and graceful error handling for MCP server connections

### Agent Management Features
- **Enable/Disable Agents:** Toggle agents without losing configuration - disabled agents don't appear in API
- **Model Selection Per Agent:** Different agents can use different models from different providers
- **Custom Instructions:** Tailor system prompts for each agent's role and capabilities
- **Tool Configuration:** Select vault tools, MCP tools, and other agents as tools independently per agent
- **Agent Settings API:** Agents can read and modify their own settings programmatically via vault tools
- **Server Restart API:** Agents can trigger server restart to apply configuration changes

### Advanced Features
- **Streaming Tool Execution:** Real-time visibility into agent tool calls and intermediate steps during streaming responses
- **CORS Support:** Full CORS enablement for cross-origin requests from web clients
- **Dynamic Model Discovery:** Automatic fetching of available models from configured providers
- **Settings UI:** React-based settings interface with Radix UI components for intuitive configuration
- **Device ID System:** Unique device identification for future multi-device coordination features
- **Configurable Port:** Customize server port for network flexibility (default: 2345)
