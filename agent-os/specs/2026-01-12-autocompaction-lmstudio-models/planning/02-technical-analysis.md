# Technical Analysis - LMStudio Context Autocompaction

## Codebase Assessment

### Existing Infrastructure

#### 1. Model Provider System
**File:** `src/models/providers/index.ts`

Current structure:
```typescript
export abstract class ModelProvider {
  id: ModelProviderID;
  baseURL: string;
  models: string[]; // Currently just model names
  plugin: ObsidianAgentsServer;
  instance?: ModelProviderInstance;

  abstract getModels(): Promise<string[]>
}
```

**Required Changes:**
- Change `models` from `string[]` to `ModelInfo[]` with context limits
- Add abstract methods: `countTokens()`, `countMessages()`
- Add helper: `getModelContextLimit(modelName: string)`

#### 2. Streaming Infrastructure
**File:** `src/lib/utils.ts`

Current `convertStreamToChunks` function:
- Already logs usage data from stream events
- Needs to accept `AgentContextManager` parameter
- Needs limit checking and warning/abort logic

#### 3. Agent System
**File:** `src/agents/types.ts` & agent initialization

Current agent context:
- Passes `agentSettings` via `context` parameter
- Can be extended to include `contextManager`

### New Components Required

#### 1. AgentContextManager Class
**File:** `src/lib/context-manager.ts` (NEW)

Responsibilities:
- Track token usage (input, output, total)
- Check against context limit with thresholds
- Provide tool-level context checking
- Store conversation history
- Signal restart when overflow detected

Key Methods:
- `updateUsage(usage: Partial<UsageData>)`
- `checkBeforeToolResponse(toolResult: string)`
- `isApproachingLimit()` / `isOverLimit()`
- `getUsageStats()`

#### 2. Pruning Agent
**File:** `src/agents/pruning-agent.ts` (NEW)

Responsibilities:
- Intelligently compact conversation history
- Preserve critical context (system message, current task, recent tools)
- Remove/summarize old tool results and completed tasks
- Return pruned conversation + summary

#### 3. Restart Loop Handler
**File:** `src/index.ts` (MODIFY)

New function: `runAgentWithContextManagement()`

Flow:
1. Run agent with current messages
2. Check if context manager signaled restart
3. If restart needed:
   - Stream "Compacting..." message
   - Run pruning agent
   - Extract pruned conversation
   - Restart with pruned messages
4. Loop with max 3 attempts

## Implementation Plan Validation

### Phase 0: Dependencies & Token Counting

#### Phase 0a: Dependencies ✅
**Required npm packages:**
```bash
pnpm add llama3-tokenizer-js llama-tokenizer-js mistral-tokenizer-js
# gpt-tokenizer already installed
```

#### Phase 0b: Model-Specific Token Counting in LMStudio Provider ✅
**Implementation approach:**
```typescript
// src/models/providers/lmstudio.ts
import { encode, encodeChat } from 'gpt-tokenizer'
import Llama3Tokenizer from 'llama3-tokenizer-js'
import LlamaTokenizer from 'llama-tokenizer-js'
import MistralTokenizer from 'mistral-tokenizer-js'

export class LMStudio extends ModelProvider {
  private llama3Tokenizer = new Llama3Tokenizer()
  private llamaTokenizer = new LlamaTokenizer()
  private mistralTokenizer = new MistralTokenizer()

  private detectModelFamily(modelName: string): 'llama3' | 'llama2' | 'mistral' | 'gpt' | 'unknown' {
    const lower = modelName.toLowerCase();
    if (lower.includes('llama-3') || lower.includes('llama3')) return 'llama3';
    if (lower.includes('llama-2') || lower.includes('llama2')) return 'llama2';
    if (lower.includes('mistral') || lower.includes('mixtral')) return 'mistral';
    if (lower.includes('gpt')) return 'gpt';
    return 'unknown';
  }

  countTokens(text: string, modelName: string): number {
    const family = this.detectModelFamily(modelName);

    try {
      switch (family) {
        case 'llama3':
          return this.llama3Tokenizer.encode(text).length;
        case 'llama2':
          return this.llamaTokenizer.encode(text).length;
        case 'mistral':
          return this.mistralTokenizer.encode(text).length;
        case 'gpt':
        case 'unknown':
        default:
          return encode(text).length; // Fallback
      }
    } catch (err) {
      console.warn(`[Tokenizer] Error for ${modelName}, falling back to gpt-tokenizer:`, err);
      return encode(text).length;
    }
  }

  countMessages(messages: any[], modelName: string): number {
    const family = this.detectModelFamily(modelName);
    let totalTokens = 0;

    for (const msg of messages) {
      const content = this.extractContent(msg);
      totalTokens += this.countTokens(content, modelName);

      // Per-message overhead varies by model family
      const overhead = family === 'mistral' ? 5 : 4;
      totalTokens += overhead;
    }

    return totalTokens + 3; // Reply priming tokens
  }
}
```

**Benefits:**
- 1-2% accuracy vs 10-15% with universal tokenizer
- Prevents premature/late compaction triggers
- Self-contained in LMStudio provider
- Graceful fallback for unknown models

#### Phase 0c: Fetch Context Limits ✅
**Valid approach:**
```typescript
interface ModelInfo {
  name: string;
  contextLimit?: number;
}

async getModels(): Promise<ModelInfo[]> {
  const res = await requestUrl(`${this.baseURL}/models`)
  return res.json.data.map(m => ({
    name: m.id,
    contextLimit: m.context_length || undefined
  }));
}
```

**Decision:** If `contextLimit` is undefined, throw error when agent tries to use it.

### Phase 1: Context Manager Infrastructure ✅

The proposed `AgentContextManager` class is valid with these adjustments:

**Key Changes:**
1. Enable only for LMStudio (check provider ID)
2. Remove `needsSummarization` flag (not needed)
3. Add restart tracking: `restartRequested`, `lastToolResult`
4. Remove configurable thresholds (use hardcoded 0.8, 0.9, 1.0)

### Phase 2: Update convertStreamToChunks ✅

The proposed changes are valid with critical modification:
1. Accept optional `contextManager` parameter
2. Extract usage from `event.usage` in stream
3. Update context manager with usage data
4. **At 90%: Trigger compaction and restart (NOT just warn)**
5. At 100%: Emergency abort only (avoid if possible)

**Critical Implementation Detail:**
When 90% threshold hit during streaming:
1. Pause current stream
2. Emit "⚙️ Compacting conversation history..." chunk
3. Run pruning agent on conversation history
4. Restart agent with pruned context
5. Resume streaming to client seamlessly

**Implementation note:** Only pass context manager for LMStudio agents.

### Phase 3: Tool Usage Example ✅

The proposed pattern is valid:
```typescript
execute: async ({ path }, context) => {
  const fileContent = await readFile(path);
  const contextManager = context.contextManager;

  if (!contextManager) return fileContent;

  const check = contextManager.checkBeforeToolResponse(fileContent);
  return check.toolResult;
}
```

**Question for implementation:** How do tools signal restart to server?
- Option A: Return special format: `{ __needsRestart: true, content: "..." }`
- Option B: Context manager stores state, server checks after tool execution
- **Recommendation:** Option B (cleaner, tools don't need special return format)

### Phase 4: Pruning Agent ✅

The proposed pruning agent is valid with adjustments:

**Key Changes:**
1. Make model configurable in settings
2. Simplify instructions (no JSON output, just return pruned messages)
3. Add error handling if pruning fails

### Phase 5: Server Restart Loop ✅

The proposed restart loop is valid with these considerations:

**Implementation notes:**
1. Max 3 restarts (configurable constant)
2. Stream "⚙️ Compacting conversation history..." before pruning
3. Check `contextManager.needsRestart()` after each tool execution
4. Update conversation in context manager after pruning

**Challenge:** Detecting restart in streaming mode
- Streaming doesn't complete synchronously
- Tool execution happens during stream
- Need to detect restart signal mid-stream

**Solution:**
- Tools don't return directly during streaming
- Agent framework handles tool execution
- Check context manager after each tool completes
- If restart needed, abort current stream and restart

### Phases 6-7: Integration ✅

Valid as proposed with these specifics:

**Agent Initialization:**
```typescript
// Create context manager only for LMStudio
if (agentSettings.modelProvider === 'lmstudio') {
  const modelInfo = provider.models.find(m => m.name === agentSettings.model);
  if (!modelInfo?.contextLimit) {
    throw new Error(`Context limit not available for ${agentSettings.model}`);
  }

  agent.contextManager = new AgentContextManager(
    {
      enabled: true,
      contextLimit: modelInfo.contextLimit,
      warningThreshold: 0.9,
      inputThreshold: 0.8
    },
    provider,
    agentSettings.model
  );
}
```

## Architecture Decisions Summary

### ✅ Valid from Original Plan
1. Two-phase approach (pre-request + real-time monitoring)
2. AgentContextManager class design
3. Token counting using gpt-tokenizer
4. Fetch context limits from model API
5. Detect → Pause → Prune → Restart flow
6. Pruning agent architecture
7. Tool-level context checking

### 🔄 Adjustments Needed
1. **Provider scope:** LMStudio only (not Ollama)
2. **Thresholds:** Hardcoded (no configuration)
3. **Notifications:** Server-side only (no Obsidian notices yet)
4. **Context limit fallback:** Error instead of defaults
5. **Pruning agent:** User-configurable model in settings
6. **Restart detection:** Context manager state tracking (not return values)

### ❓ Implementation Questions
1. **Settings UI placement for pruning agent config:**
   - Global setting vs per-agent setting?
   - Where in existing settings structure?

2. **Pre-request estimation implementation:**
   - When to run? (before agent.run()?)
   - How to trigger proactive pruning?
   - Estimate all messages + system prompt + buffer for output

3. **Streaming restart detection:**
   - How to abort current stream when tool signals restart?
   - How to seamlessly continue after restart?

## Risk Assessment

### Low Risk
- Token counting with gpt-tokenizer (already working)
- Context limit fetching (straightforward API)
- AgentContextManager class (self-contained logic)

### Medium Risk
- Restart loop complexity (multiple edge cases)
- Pre-request estimation (need accurate projection)
- Pruning agent effectiveness (quality of compaction)

### High Risk
- Streaming restart detection (complex async flow)
- Tool execution during restart (race conditions)
- Context manager state consistency across restarts

## Next Steps

After requirements approval:
1. Design settings UI for pruning agent configuration
2. Determine pre-request estimation trigger point
3. Design streaming restart detection mechanism
4. Create detailed implementation task list
5. Write formal specification document
