# Specification: LMStudio Context Autocompaction

## Goal

Implement a three-phase context management system that prevents LMStudio from silently truncating conversation context (its default "cut middle" behavior) by proactively compacting conversations at 80% and 90% thresholds before hitting the context limit.

## User Stories

- As a user chatting with an LMStudio model, I want the system to automatically compress my conversation history when approaching context limits so that I can continue my conversation without interruption
- As a user, I want to see inline notifications when compaction occurs so that I understand what is happening
- As a user, I want to configure which model handles conversation pruning so that I can balance speed and quality
- As a developer, I want context management to be isolated to LMStudio so that other providers remain unaffected

## Core Requirements

### Three-Phase Compaction Strategy

1. **Pre-Request Compaction (80% threshold)**
   - Estimate input tokens before sending request to model
   - Trigger synchronous compaction if estimated usage exceeds 80%
   - Compact conversation, then proceed with request

2. **Tool Response Monitoring (dynamic threshold)**
   - Check if tool result would overflow context before adding it
   - Most critical defense against LMStudio's "cut middle" behavior
   - Signal restart if tool result would cause overflow
   - Compact conversation while preserving the tool result

3. **Real-Time Streaming Compaction (90% threshold)**
   - Monitor token usage during streaming generation
   - At 90%: pause stream, compact conversation, restart agent
   - At 100%: emergency abort only (avoid at all costs)
   - Goal: never abort, always compact and continue

### Model-Specific Tokenization

- Detect model family from model name (llama3, llama2, mistral, gpt)
- Use appropriate tokenizer library for each family
- Fallback to gpt-tokenizer for unknown models
- Tokenization scoped to LMStudio provider only

### Context Limit Handling

- Context limit must be available from LMStudio model API
- Throw error on agent initialization if context limit unavailable
- No fallback lookup tables or default values

### User Notifications

- Server-side SSE stream messages visible in OpenWebUI
- Messages: "Compacting conversation history...", "Context compacted, continuing..."
- Server logs for debugging and monitoring
- Websocket/Obsidian Notice deferred to future feature

### Pruning Agent

- User-configurable in settings (which agent/model to use)
- Default: same model as the agent being pruned
- Returns pruned conversation as JSON with summary
- Fallback to simple truncation if pruning fails

## Reusable Components

### Existing Code to Leverage

- **ModelProvider base class** (`src/models/providers/index.ts`): Extend with token counting methods
- **LMStudio provider** (`src/models/providers/lmstudio.ts`): Add tokenizer logic and context limit fetching
- **convertStreamToChunks** (`src/lib/utils.ts`): Already logs usage data, extend with threshold monitoring
- **gpt-tokenizer**: Already installed as dependency
- **Agent system** (`src/agents/types.ts`): AgentSettings can be extended for pruning agent config
- **Runner context** (`src/index.ts`): Already passes agentSettings via context, extend for contextManager

### New Components Required

| Component | File Path | Rationale |
|-----------|-----------|-----------|
| AgentContextManager | `src/lib/context-manager.ts` | Central coordinator for token tracking, threshold monitoring, and restart signaling - no existing equivalent |
| Pruning Agent | `src/agents/pruning-agent.ts` | Specialized agent for intelligent conversation compaction - distinct from existing agents |
| Model-specific tokenizers | Extend `src/models/providers/lmstudio.ts` | Family-specific tokenization needed for accuracy - only LMStudio requires this |

### New Dependencies Required

- `llama3-tokenizer-js`: Llama 3 family tokenization
- `llama-tokenizer-js`: Llama 2 family tokenization
- `mistral-tokenizer-js`: Mistral/Mixtral family tokenization

## Technical Approach

### AgentContextManager Class

Responsibilities:
- Track token usage (input, output, total)
- Check thresholds (80% pre-request, 90% real-time)
- Store conversation history
- Signal restart when tool overflow detected
- Provide usage statistics

Key state:
- `conversationHistory`: Current messages array
- `restartRequested`: Boolean flag for tool overflow
- `lastToolResult`: Store tool result during restart
- Token usage counters (input, output, total)

Lifecycle:
- Created once per LMStudio agent instance
- Reset token counts between requests
- Persists conversation history across compaction cycles

### Model Family Detection

Location: LMStudio provider class

Detection logic (case-insensitive):
- `llama-3` or `llama3` -> llama3 family
- `llama-2` or `llama2` -> llama2 family
- `mistral` or `mixtral` -> mistral family
- `gpt` -> gpt family
- Unknown -> fallback to gpt-tokenizer

### Token Counting Methods

Add to LMStudio provider:
- `countTokens(text: string, modelName: string): number`
- `countMessages(messages: any[], modelName: string): number`

Message counting adds per-message overhead (4-5 tokens depending on family).

### Pre-Request Estimation Flow

Location: `/v1/chat/completions` endpoint, before `runner.run()`

1. Check if agent has context manager (LMStudio only)
2. Update conversation history with incoming messages
3. Estimate total input tokens (messages + system prompt + output buffer)
4. If > 80% threshold: run pruning agent synchronously
5. Replace messages with pruned version
6. Proceed with agent run

### Tool Response Check Flow

Location: Inside tool execution functions

1. Tool gets result (e.g., file content)
2. Call `contextManager.checkBeforeToolResponse(result)`
3. Context manager calculates: current tokens + result tokens
4. If would overflow: mark restart needed, store tool result
5. Return result to agent (agent framework continues)
6. Server detects restart flag after tool completes
7. Server runs pruning agent, keeps tool result
8. Restart agent with pruned context

### Real-Time Streaming Flow

Location: `convertStreamToChunks` function

1. Extract usage from stream events (already logged)
2. Update context manager with usage data
3. Calculate percentage of context used
4. At 90%:
   - Emit "Compacting..." chunk to client
   - Signal compaction needed
   - Return from generator (abort current stream)
5. Server detects 90% abort, runs pruning
6. Server restarts agent with pruned context
7. Continue streaming to client

### Restart Loop Handler

Location: Wrapper function in `src/index.ts`

1. Run agent with current messages
2. Check context manager for restart signal
3. If restart needed:
   - Stream compaction message
   - Run pruning agent
   - Update messages with pruned version
   - Loop back to step 1
4. Max 3 restart attempts
5. Error if pruning doesn't reduce size enough

### Pruning Agent Design

Instructions focus on:
- Preserve: system message, current task, recent 3-5 messages, active tool results
- Compact: old tool results, completed sub-tasks, redundant messages
- Target: 40-60% token reduction

Output format (JSON):
```json
{
  "prunedConversation": [...messages],
  "summary": "Removed 5 old tool results",
  "originalTokens": 12000,
  "prunedTokens": 5000
}
```

Fallback on failure: keep system message + last 5 messages.

### Settings UI

Location: LMStudio provider settings section

New setting: `pruningAgentId`
- Type: Select dropdown
- Options: "Same as current agent" (default) + list of available agents
- Stored in: `ObsidianAgentsServerSettings.pruningAgentId` (global)

### Model API Changes

LMStudio `getModels()` must return:
- Model name/id
- Context limit (from `context_length` field)

Change `models: string[]` to `models: ModelInfo[]` where:
```typescript
interface ModelInfo {
  name: string;
  contextLimit?: number;
}
```

## Out of Scope

- **Ollama/OpenAI providers**: Context management only for LMStudio
- **Configurable thresholds**: Use hardcoded 80/90/100%
- **Obsidian Notice UI**: Deferred to Obsidian sync feature
- **Automated tests**: Manual testing only for MVP
- **Additional model families**: Only llama3, llama2, mistral, gpt for now
- **Adaptive thresholds**: No dynamic adjustment based on model behavior
- **Per-agent pruning configuration**: Global setting only

## Edge Cases

### Tool Result Causes Overflow
- Context manager marks restart needed
- Stores tool result separately
- Pruning agent compacts history but keeps tool result
- Agent restarts with pruned context + full tool result

### Multiple Consecutive Restarts
- Max 3 restart attempts per request
- If pruning doesn't reduce enough after 3 tries: return error
- Log each restart attempt for debugging

### Pruning Agent Failure
- Catch all errors from pruning agent
- Fallback: keep system message + last 5 messages
- Log failure details for debugging
- Continue with fallback pruned context

### Missing Context Limit
- Check during agent initialization
- Throw descriptive error if `contextLimit` undefined
- User sees error in server logs
- Agent cannot be used until model provides context limit

### Very Long Single Tool Result
- If single tool result > context limit: cannot be fixed by compaction
- Return error explaining the tool result exceeds model's context limit
- Suggest using a model with larger context

### Streaming Restart Mid-Generation
- At 90%: current stream returns/aborts
- Compaction message sent to client
- New stream started with pruned context
- Client sees seamless continuation after compaction message

### Context Manager Not Present
- Tools check for context manager existence
- If not present (non-LMStudio agent): skip all checks
- Return tool result directly without modification

## Success Criteria

- Conversations with LMStudio models never hit context limit silently
- Users see clear feedback when compaction occurs via SSE messages
- Tool responses that would overflow trigger compaction instead of truncation
- Pruning reduces token count by 40-60% while preserving task context
- Max 3 compaction cycles per request prevents infinite loops
- Token counting accuracy within 5% of actual usage for supported model families
- No impact on Ollama or OpenAI provider behavior

## Dependencies Summary

### New npm packages:
- `llama3-tokenizer-js`
- `llama-tokenizer-js`
- `mistral-tokenizer-js`

### Existing packages used:
- `gpt-tokenizer` (already installed)
- `@openai/agents` (Runner, Agent)
- `hono` (SSE streaming)

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/lib/context-manager.ts` | NEW | AgentContextManager class |
| `src/agents/pruning-agent.ts` | NEW | Pruning agent creation function |
| `src/models/providers/index.ts` | MODIFY | Add token counting abstract methods |
| `src/models/providers/lmstudio.ts` | MODIFY | Add tokenizers, model family detection, context limit fetching |
| `src/lib/utils.ts` | MODIFY | Extend convertStreamToChunks with context monitoring |
| `src/index.ts` | MODIFY | Add restart loop handler, integrate context manager |
| `src/settings/types.ts` | MODIFY | Add pruningAgentId to settings |
| `src/agents/types.ts` | MODIFY | No changes needed (context manager passed via runner context) |
| Settings UI component | MODIFY | Add pruning agent dropdown to LMStudio settings |
