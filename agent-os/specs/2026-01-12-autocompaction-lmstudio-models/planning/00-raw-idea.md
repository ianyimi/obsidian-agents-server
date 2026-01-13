# Raw Idea: Autocompaction for LMStudio Models

## Feature Description

Implement an automatic context management and compaction system for LMStudio models that prevents context overflow by intelligently monitoring token usage and pruning conversations when approaching limits.

## Core Concept

The system uses a two-phase token management approach combined with intelligent conversation pruning to ensure conversations stay within model context limits:

1. **Phase A: Input Estimation (Before Request)**
   - Estimate input tokens before sending to model
   - Check against limit proactively
   - Trigger trimming if estimated total would overflow
   - Prevents silent truncation in LMStudio/local models

2. **Phase B: Real-time Monitoring (During Streaming)**
   - Read actual usage from OpenAI Agents SDK stream events
   - Track cumulative tokens as stream progresses
   - Abort if approaching limit during generation
   - Leverage built-in usage tracking (no manual counting)

## Key Components

### Context Overflow Handling Strategy
**Detect → Pause → Prune → Restart**

When context overflow is detected:
1. **Detect**: Monitor token usage in real-time
2. **Pause**: Stop current stream/request
3. **Prune**: Use intelligent compaction agent to summarize conversation
4. **Restart**: Resume with compacted context

### Token Counting Per Provider

- **LMStudio**: Token counting via tokenizer library (no API usage tracking)
- **Ollama**: Similar approach to LMStudio
- **OpenAI**: Direct usage tracking from API responses

### AgentContextManager Infrastructure

Central manager that:
- Tracks conversation history and token usage
- Triggers compaction when approaching limits
- Coordinates between chat completion handlers and pruning agent
- Manages context state across requests

### Pruning Agent

Intelligent conversation compaction that:
- Summarizes conversation history to reduce token count
- Preserves critical context and recent messages
- Removes redundant tool results
- Maintains conversation coherence
- Aims to retain task context while reducing tokens by 50-70%

### Integration Points

- **Streaming Chat Completions**: Monitor usage during streams
- **Non-streaming Chat Completions**: Check usage after completion
- **Context Limit Configuration**: Per-model limits and thresholds
- **User Feedback**: Warn users when approaching limits

## Implementation Plan Reference

Detailed implementation plan available at:
`/Users/zaye/Documents/Obsidian/Vaults/The Dev Lab/.obsidian/plugins/obsidian-agents-server.git/dev/CONTEXT_MANAGEMENT_STREAMING_PLAN.md`

## Goals

1. Prevent context overflow errors in LMStudio and local models
2. Enable longer conversations without manual intervention
3. Provide transparent feedback about context usage
4. Maintain conversation quality through intelligent pruning
5. Support multiple LLM providers with provider-specific handling

## Success Criteria

- Conversations automatically compact before hitting context limits
- Users receive clear feedback about context status
- Pruning maintains conversation coherence and task context
- System works across all supported providers (LMStudio, Ollama, OpenAI)
- Token usage is accurately tracked and reported
