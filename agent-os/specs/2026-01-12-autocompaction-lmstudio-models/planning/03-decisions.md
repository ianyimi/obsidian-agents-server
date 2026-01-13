# Key Decisions - LMStudio Context Autocompaction

## Decision Log

### Decision 1: Provider Scope
**Question:** Which providers should have context management enabled?

**Options:**
- A) All providers (LMStudio, Ollama, OpenAI)
- B) Local providers only (LMStudio, Ollama)
- C) LMStudio only

**Decision:** C - LMStudio only

**Rationale:**
- LMStudio models may silently truncate context
- OpenAI/cloud providers handle context gracefully
- Ollama deferred to future enhancement
- Keeps MVP focused

**Impact:** Context manager only instantiated for LMStudio agents

---

### Decision 2: Threshold Configuration
**Question:** Should warning/pruning thresholds be configurable?

**Options:**
- A) Fully configurable per-agent in UI
- B) Global configuration in settings
- C) Hardcoded defaults only

**Decision:** C - Hardcoded defaults only

**Defaults:**
- 80% - Pre-request proactive compaction trigger
- 90% - Real-time proactive compaction trigger (AUTO-COMPACT, not just warn)
- 100% - Emergency stream abort (avoid at all costs)

**Rationale:**
- Simplifies MVP implementation
- Good defaults based on research
- 90% triggers automatic compaction to avoid hitting 100%
- Can add configuration later if needed

**Impact:** No UI needed for threshold configuration

---

### Decision 3: Pruning Agent Model
**Question:** What model should the pruning agent use?

**Options:**
- A) Always same model as original agent
- B) User-configurable in settings
- C) Hardcoded to specific fast model

**Decision:** B - User-configurable in settings

**Rationale:**
- Flexibility for users to choose fast/cheap model
- Some users may prefer same model for consistency
- No hardcoding that limits use cases

**Impact:** Need settings UI to select pruning agent/model

**Default:** Use same model as the agent being pruned

---

### Decision 4: Tokenizer Strategy
**Question:** Use model-specific tokenizers or universal approximation?

**Options:**
- A) Model-specific (llama3-tokenizer, mistral-tokenizer, etc.)
- B) Universal gpt-tokenizer for all models
- C) Hybrid approach with fallbacks

**Decision:** C - Hybrid approach (model-specific with fallback)

**Implementation:**
- Switch statement in LMStudio provider based on model family detection
- Model families: llama3, llama2, mistral, gpt, unknown
- Fallback to gpt-tokenizer for unknown models
- Libraries: llama3-tokenizer-js, llama-tokenizer-js, mistral-tokenizer-js, gpt-tokenizer

**Rationale:**
- Better accuracy (1-2% variance vs 10-15%)
- Prevents premature/late compaction triggers
- Self-contained in LMStudio provider (doesn't leak to other code)
- Graceful fallback for unknown models
- Worth the small complexity for accuracy gain

**Trade-offs:**
- 3-4 additional npm dependencies
- Need to maintain model family detection logic
- Some edge case models may not match any family (use fallback)

**Impact:**
- Install tokenizer libraries
- Implement model family detection in LMStudio provider only

---

### Decision 5: Context Limit Detection
**Question:** How to handle missing context limits?

**Options:**
- A) Fallback to conservative default (8192)
- B) Fallback lookup table by model name
- C) Error if context limit unavailable
- D) Fetch from model API, disable if unavailable

**Decision:** C - Error if context limit unavailable

**Rationale:**
- Context limit should always be available from LMStudio API
- Better to fail explicitly than use wrong limit
- Forces users to ensure model metadata is correct

**Impact:**
- Error thrown during agent initialization if limit missing
- User sees error in server logs
- No silent failures or wrong limits

---

### Decision 6: Notification Strategy
**Question:** How to notify users of context management actions?

**Options:**
- A) Obsidian Notice UI (client-side)
- B) Server logs only
- C) Websocket events to plugin (for future Notice UI)
- D) Both server logs and inline stream messages

**Decision:** D (server logs) + Inline SSE messages + C (deferred websocket)

**MVP:** Server-side logging + SSE stream messages
**Future:** Websocket events → Obsidian Notice UI

**Rationale:**
- Obsidian Notice requires websocket infrastructure (deferred)
- Websocket deferred to Obsidian sync feature
- Server logs for debugging
- **SSE stream messages visible in OpenWebUI** (no extra work needed)
- Stream messages: "⚙️ Compacting conversation history...", "✅ Context compacted"

**Impact:**
- No client-side UI work needed for MVP
- OpenWebUI automatically displays SSE messages in chat
- Will integrate with future websocket system for Obsidian plugin

---

### Decision 7: Implementation Scope
**Question:** Implement both pre-request estimation AND real-time monitoring?

**Options:**
- A) Pre-request estimation only (Phase A)
- B) Real-time monitoring only (Phase B)
- C) Both phases + tool response monitoring

**Decision:** C - Three-phase implementation

**Three Phases:**
1. **Pre-request (80%):** Estimate input tokens before sending to model, compact if needed
2. **Tool response:** Check if tool result fits in context before adding, compact if needed
3. **Real-time (90%):** Monitor during streaming, **auto-compact and continue** (not just warn)

**Rationale:**
- Pre-request prevents sending oversized requests to LMStudio
- Tool response monitoring prevents LMStudio's "cut middle" behavior (CRITICAL)
- Real-time catches overflow during model generation
- **90% triggers automatic compaction, not just warning**
- Goal: Avoid aborting runs at all costs, rely on proactive compaction

**Impact:**
- Full three-phase implementation required
- Tool response monitoring is most critical defense against context truncation
- Real-time compaction at 90% ensures we never hit 100% abort

---

### Decision 8: Testing Strategy
**Question:** Automated testing or manual testing?

**Options:**
- A) Build automated test suite
- B) Manual testing only
- C) Hybrid approach

**Decision:** B - Manual testing only

**Rationale:**
- No existing test infrastructure in project
- MVP focus on functionality, not test coverage
- User will manually test edge cases

**Impact:** No automated tests in initial implementation

---

### Decision 9: Tool Restart Signaling
**Question:** How should tools signal that restart is needed?

**Options:**
- A) Special return format: `{ __needsRestart: true, content: "..." }`
- B) Context manager stores state, server checks after execution
- C) Throw special exception that server catches

**Decision:** B - Context manager state tracking

**Rationale:**
- Cleaner tool implementation (no special return format)
- Context manager already tracking state
- Server checks `contextManager.needsRestart()` after tools
- No special exceptions or return formats needed

**Impact:**
- Tools just call `checkBeforeToolResponse()`
- Context manager internally tracks restart flag
- Server polls context manager for restart signal

---

### Decision 10: Pruning Agent Output Format
**Question:** What format should pruning agent return?

**Options:**
- A) JSON with pruned messages + summary
- B) Just pruned messages as conversation
- C) Structured format with metadata

**Decision:** A - JSON with pruned messages + summary

**Rationale:**
- Need both pruned conversation and explanation
- JSON easy to parse programmatically
- Summary useful for logging/debugging

**Format:**
```json
{
  "prunedConversation": [...],
  "summary": "Removed 5 old tool results, compacted 3 messages"
}
```

**Impact:** Pruning agent must return valid JSON

---

## Open Questions for Implementation

### Question 1: Settings UI Placement
**Where should pruning agent configuration go?**

Options:
- A) Global setting: "Default pruning agent for all agents"
- B) Per-agent setting: Each agent can specify its pruning agent
- C) Provider-level setting: "LMStudio pruning agent"

**Needs decision before:** Settings UI implementation

**Recommendation:** Per-agent setting (most flexible)

---

### Question 2: Pre-Request Estimation Trigger
**When/where should pre-request estimation run?**

Options:
- A) In chat completions endpoint before agent.run()
- B) In context manager as separate method call
- C) Automatically in context manager when history updated

**Needs decision before:** Pre-request estimation implementation

**Recommendation:** A - Explicit call in endpoint before agent.run()

---

### Question 3: Streaming Restart Detection
**How to detect restart signal during streaming?**

Options:
- A) Agent framework callbacks for tool execution
- B) Poll context manager periodically during stream
- C) Abort stream, check, restart if needed after each tool

**Needs decision before:** Streaming restart implementation

**Recommendation:** Needs investigation of OpenAI agents SDK capabilities

---

### Question 4: Context Manager Lifecycle
**When is context manager created/destroyed?**

Options:
- A) One per agent instance (persistent across requests)
- B) New for each request (recreated each time)
- C) Pooled and reused

**Needs decision before:** Agent initialization

**Recommendation:** A - One per agent instance, reset between requests

---

## Dependencies Between Decisions

```
Decision 1 (LMStudio only)
  └─> Affects: Agent initialization, Provider extensions

Decision 3 (Pruning agent configurable)
  └─> Requires: Settings UI design (Question 1)

Decision 4 (Universal tokenizer)
  └─> Affects: Provider token counting implementation

Decision 5 (Error if no limit)
  └─> Affects: Agent initialization, Error handling

Decision 9 (State tracking)
  └─> Affects: Tool implementation, Server restart loop

Decision 10 (JSON format)
  └─> Affects: Pruning agent prompt, Server parsing logic
```

## Summary

**MVP Scope:**
- ✅ LMStudio only
- ✅ Hardcoded thresholds (80/90/100%)
- ✅ User-configurable pruning agent
- ✅ Universal tokenizer (gpt-tokenizer)
- ✅ Error if no context limit
- ✅ Server-side logging only
- ✅ Both pre-request and real-time phases
- ✅ Manual testing
- ✅ State-based restart signaling
- ✅ JSON pruning output

**Deferred to Future:**
- Ollama/OpenAI support
- Configurable thresholds
- Obsidian Notice UI
- Automated testing
- Model-specific tokenizers
