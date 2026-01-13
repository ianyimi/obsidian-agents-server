# Requirements - LMStudio Context Autocompaction

## User Answers to Clarifying Questions

### 1. Provider Scope
- **Context management enabled by default ONLY for LMStudio**
- NOT enabled for Ollama or OpenAI providers

### 2. Thresholds
- **No configuration UI for thresholds**
- Use hardcoded defaults:
  - 80% for pre-request proactive compaction
  - 90% for real-time proactive compaction (NOT just warning)
  - 100% for emergency stream abort (avoid if possible)

### 3. Pruning Agent Configuration
- **Pruning agent should be configurable in settings**
- Need to determine placement in settings UI
- User can specify which agent/model to use for pruning

### 4. Tokenizer Strategy
- **DECISION: Use model-specific tokenizers per model family**
- Implement in LMStudio provider class using switch statement
- Model family detection: llama3, llama2, mistral, gpt
- Fallback to gpt-tokenizer for unknown models
- Libraries: llama3-tokenizer-js, llama-tokenizer-js, mistral-tokenizer-js, gpt-tokenizer
- **Rationale:** Better accuracy (1-2% vs 10-15% variance), scoped to LMStudio only

### 5. Context Limit Detection
- **Context limit should ALWAYS be available**
- No fallback lookup tables needed
- If context limit cannot be determined: show error in server when limit reached

### 6. User Experience - Notifications
- **Will use Obsidian Notice function** from obsidian package
- Plugin receives websocket events and emits notices
- **Websocket/notice functionality to be implemented LATER** (when Obsidian sync added)
- **For now: server-side notifications only** (logs/console)

### 7. Implementation Scope
- **YES - Implement both phases:**
  - Phase A: Pre-request input estimation (80% threshold → compact before sending)
  - Phase B: Real-time monitoring during streaming (90% threshold → pause, compact, continue)
- Real-time easier to implement (token stats available from stream)
- **Critical:** At 90%, automatically compact and continue (NOT just warn)
- **Goal:** Avoid aborting runs at all costs, rely on autocompaction instead

### 8. Testing Strategy
- **All manual testing for now**
- No automated testing setup in project yet
- User will manually test edge cases

## Key Requirements Summary

### Must Have (MVP)
1. ✅ Context management for LMStudio provider only
2. ✅ Model-specific token counting per model family (llama3, llama2, mistral, gpt)
3. ✅ AgentContextManager class with usage tracking
4. ✅ Pre-request input estimation (80% threshold → compact before request)
5. ✅ Real-time monitoring during streaming (90% → compact & continue, 100% → abort emergency)
6. ✅ Pruning agent for conversation compaction
7. ✅ Global settings UI for configuring pruning agent (in LMStudio provider settings)
8. ✅ Three-phase compaction: Pre-request, Tool response, Real-time streaming
9. ✅ Server-side SSE notifications visible in OpenWebUI
10. ✅ Context limit must be available (error if not)
11. ✅ Tool response monitoring to prevent LMStudio's "cut middle" behavior

### Nice to Have (Future)
- Even more model families (qwen, phi, gemma, etc.)
- Configurable thresholds per agent
- Websocket events for client-side Obsidian notices
- Context management for other providers (Ollama, OpenAI)
- Automated testing suite
- Adaptive threshold adjustment based on model behavior

### Explicitly Out of Scope
- Obsidian Notice UI (deferred to Obsidian sync feature)
- Threshold configuration UI
- Ollama/OpenAI context management
- Automated tests

## Technical Decisions

### Token Counting
- **Decision:** Use model-specific tokenizers per model family
- **Implementation:** Switch statement in LMStudio provider based on model family detection
- **Libraries:** llama3-tokenizer-js, llama-tokenizer-js, mistral-tokenizer-js, gpt-tokenizer
- **Model families:** llama3, llama2, mistral, gpt, unknown (fallback to gpt-tokenizer)
- **Rationale:** Better accuracy (1-2% variance vs 10-15%), prevents premature/late compaction
- **Scope:** LMStudio provider only, self-contained in one class

### Context Limit Source
- **Decision:** Must be fetched from model provider API
- **Rationale:** No fallback tables to maintain
- **Error handling:** Server error when limit unavailable

### Pruning Agent Model
- **Decision:** User-configurable in settings
- **Rationale:** Flexibility to use same model or smaller/faster model
- **Default:** Same model as the agent being pruned

### Notification Strategy
- **Decision:** Server-side SSE stream messages only for MVP
- **Rationale:** Websocket/Obsidian Notice deferred to later feature
- **OpenWebUI Integration:** SSE messages automatically visible in OpenWebUI chat interface
- **Messages:** "⚙️ Compacting conversation history...", "✅ Context compacted, continuing..."
- **Future:** Will integrate with Obsidian sync websocket events for Obsidian plugin client

## Architecture Validation

### Existing Code Analysis
✅ `convertStreamToChunks` in `src/lib/utils.ts` already logs usage data
✅ `ModelProvider` base class in `src/models/providers/index.ts` exists
✅ Agent context system passes `agentSettings` via `context`
✅ `gpt-tokenizer` already in dependencies

### Required Changes
- Extend `ModelProvider` with token counting methods
- Create `AgentContextManager` class in `src/lib/context-manager.ts`
- Update `convertStreamToChunks` to use context manager
- Create pruning agent in `src/agents/pruning-agent.ts`
- Add restart loop handling in `src/index.ts`
- Add pruning agent configuration to settings UI
- Update agent initialization to create context managers

## Edge Cases to Handle

### 1. Tool Results Overflow
- Tool checks context before returning large results
- Signals restart if projected total > limit
- Server handles pruning and restart

### 2. Streaming Approaches Limit (90% Threshold)
- Real-time monitoring during stream
- At 90%: Pause stream, run compaction, restart with pruned context
- Stream "⚙️ Compacting..." message to user
- Continue generation after compaction
- **Avoid aborting at all costs**

### 3. Multiple Consecutive Restarts
- Max 3 restart attempts
- Error if pruning doesn't reduce size enough
- Log each restart attempt

### 4. Pruning Agent Failure
- Catch errors from pruning agent
- Log failure details
- Return error to client if pruning fails

### 5. Missing Context Limit
- Check on agent initialization
- Throw error if context limit unavailable
- User sees error message in server logs

## Implementation Clarifications

### Pruning Agent Settings Location
- **Decision:** Global setting in LMStudio provider settings
- Simple dropdown to select which agent/model to use for compaction
- Default: "Same as current agent"

### Model-Specific Tokenizers
- **Decision:** YES, implement per-model family tokenizers
- Switch statement in LMStudio provider class
- Model families: llama3, llama2, mistral, gpt, unknown
- Fallback to gpt-tokenizer for unknown families

### Real-Time Monitoring at 90%
- **Decision:** Automatic compaction, NOT just warning
- Pause stream → compact → restart → continue
- Only abort at 100% as emergency fallback
- Goal: Never abort, always compact and continue

### Three-Phase Compaction Strategy
1. **Pre-request (80%):** Estimate tokens, compact before sending to model
2. **Tool response:** Check if tool result fits, compact if needed before adding
3. **Real-time (90%):** Monitor during streaming, compact if approaching limit
