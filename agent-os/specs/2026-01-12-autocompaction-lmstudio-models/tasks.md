# Task Breakdown: LMStudio Context Autocompaction

## Overview
Total Tasks: 10 Task Groups
Implementation Strategy: Three-phase defense against context truncation (Pre-request, Tool Response, Real-time)

## Task List

### Foundation Layer

#### Task Group 1: Install Model-Specific Tokenizers
**Dependencies:** None

- [ ] 1.0 Install tokenizer dependencies
  - [ ] 1.1 Install llama3-tokenizer-js for Llama 3 family models
    - Run: `pnpm add llama3-tokenizer-js`
  - [ ] 1.2 Install llama-tokenizer-js for Llama 2 family models
    - Run: `pnpm add llama-tokenizer-js`
  - [ ] 1.3 Install mistral-tokenizer-js for Mistral/Mixtral family models
    - Run: `pnpm add mistral-tokenizer-js`
  - [ ] 1.4 Verify gpt-tokenizer is already installed
    - Check package.json dependencies
    - Will be used as fallback for unknown model families

**Acceptance Criteria:**
- All four tokenizer libraries available
- No installation errors
- Package.json updated with new dependencies

---

#### Task Group 2: Extend ModelProvider Base Class
**Dependencies:** Task Group 1

- [ ] 2.0 Add token counting infrastructure to ModelProvider base
  - [ ] 2.1 Update ModelInfo interface to include context limits
    - Change `models: string[]` to `models: ModelInfo[]`
    - Add `ModelInfo` interface with `name: string` and `contextLimit?: number`
    - Location: `src/models/providers/index.ts`
  - [ ] 2.2 Add abstract token counting methods to ModelProvider base class
    - `abstract countTokens(text: string, modelName: string): number`
    - `abstract countMessages(messages: any[], modelName: string): number`
    - Both methods should be implemented by each provider
  - [ ] 2.3 Add helper method to get context limit by model name
    - `getModelContextLimit(modelName: string): number | undefined`
    - Returns context limit from ModelInfo array
    - Returns undefined if model not found or limit unavailable

**Acceptance Criteria:**
- ModelProvider base class has abstract token counting methods
- ModelInfo interface includes contextLimit field
- Helper method successfully retrieves context limits

---

### LMStudio Provider Enhancements

#### Task Group 3: Implement Token Counting in LMStudio Provider
**Dependencies:** Task Groups 1, 2

- [ ] 3.0 Implement model-specific token counting for LMStudio
  - [ ] 3.1 Import tokenizer libraries at top of LMStudio provider
    - Import: gpt-tokenizer (encode, encodeChat)
    - Import: Llama3Tokenizer from llama3-tokenizer-js
    - Import: LlamaTokenizer from llama-tokenizer-js
    - Import: MistralTokenizer from mistral-tokenizer-js
    - Location: `src/models/providers/lmstudio.ts`
  - [ ] 3.2 Initialize tokenizer instances in LMStudio class
    - `private llama3Tokenizer = new Llama3Tokenizer()`
    - `private llamaTokenizer = new LlamaTokenizer()`
    - `private mistralTokenizer = new MistralTokenizer()`
  - [ ] 3.3 Implement model family detection method
    - `private detectModelFamily(modelName: string): 'llama3' | 'llama2' | 'mistral' | 'gpt' | 'unknown'`
    - Case-insensitive string matching:
      - Contains 'llama-3' or 'llama3' → 'llama3'
      - Contains 'llama-2' or 'llama2' → 'llama2'
      - Contains 'mistral' or 'mixtral' → 'mistral'
      - Contains 'gpt' → 'gpt'
      - Otherwise → 'unknown'
  - [ ] 3.4 Implement countTokens method with family-specific logic
    - Use switch statement based on detected family
    - llama3: `this.llama3Tokenizer.encode(text).length`
    - llama2: `this.llamaTokenizer.encode(text).length`
    - mistral: `this.mistralTokenizer.encode(text).length`
    - gpt/unknown: `encode(text).length` (fallback)
    - Wrap in try-catch, fallback to gpt-tokenizer on error
  - [ ] 3.5 Implement countMessages method with per-message overhead
    - Loop through messages, count tokens per message
    - Add per-message overhead: 5 tokens for mistral, 4 for others
    - Add 3 tokens for reply priming
    - Use `extractContent()` helper to get text from message
  - [ ] 3.6 Update getModels to return ModelInfo with context limits
    - Fetch models from LMStudio API
    - Extract `context_length` field from each model
    - Return array of `{ name: string, contextLimit?: number }`
    - Log warning if context_length missing for any model

**Acceptance Criteria:**
- All tokenizer libraries imported and initialized
- Model family detection correctly identifies llama3, llama2, mistral, gpt families
- countTokens returns accurate token count per family (1-2% variance)
- countMessages includes per-message overhead and reply priming
- getModels returns context limits from LMStudio API

---

### Context Management Infrastructure

#### Task Group 4: Create AgentContextManager Class
**Dependencies:** Task Groups 2, 3

- [ ] 4.0 Build AgentContextManager for token tracking and threshold monitoring
  - [ ] 4.1 Create context-manager.ts file with interfaces
    - Create file: `src/lib/context-manager.ts`
    - Define `ContextManagerOptions` interface:
      - `enabled: boolean`
      - `contextLimit: number`
      - `warningThreshold: number` (0.9 for 90%)
      - `inputThreshold: number` (0.8 for 80%)
    - Define `UsageData` interface:
      - `inputTokens: number`
      - `outputTokens: number`
      - `totalTokens: number`
    - Define `ToolResponseCheck` interface:
      - `needsRestart: boolean`
      - `toolResult: string`
  - [ ] 4.2 Implement AgentContextManager class constructor and state
    - Constructor parameters: `options: ContextManagerOptions`, `modelProvider: ModelProvider`, `modelName: string`
    - State properties:
      - `private usage: UsageData` (current request usage)
      - `private conversationHistory: any[]` (message array)
      - `private restartRequested: boolean` (tool overflow flag)
      - `private lastToolResult: string | null` (stored tool result)
  - [ ] 4.3 Implement usage tracking methods
    - `updateUsage(usage: Partial<UsageData>): void` - Update current usage stats
    - `reset(): void` - Reset usage counters between requests
    - `getCurrentTotal(): number` - Return total tokens used
    - `getUsagePercentage(): number` - Return percentage of context used
    - `getUsageStats(): UsageData` - Return full usage data
  - [ ] 4.4 Implement threshold checking methods
    - `isEnabled(): boolean` - Check if context management enabled
    - `isApproachingLimit(threshold: number): boolean` - Check if usage exceeds threshold
    - `isOverLimit(): boolean` - Check if usage >= 100% of limit
  - [ ] 4.5 Implement conversation history management
    - `updateConversationHistory(messages: any[]): void` - Store current conversation
    - `getConversationHistory(): any[]` - Retrieve conversation array
  - [ ] 4.6 Implement pre-request estimation
    - `estimateInputTokens(messages: any[]): number`
    - Use `modelProvider.countMessages()` to count conversation tokens
    - Add output buffer: 20% of remaining context or min 1000 tokens
    - Return total estimated tokens
  - [ ] 4.7 Implement tool response checking
    - `checkBeforeToolResponse(toolResult: string): ToolResponseCheck`
    - Calculate: current tokens + tool result tokens
    - If projected > context limit: return `{ needsRestart: true, toolResult }`
    - Otherwise: return `{ needsRestart: false, toolResult }`
    - Log warnings when overflow detected
  - [ ] 4.8 Implement restart signaling methods
    - `markRestartNeeded(toolResult: string): void` - Set restart flag and store tool result
    - `needsRestart(): boolean` - Check restart flag
    - `getLastToolResult(): string | null` - Retrieve stored tool result
    - `resetRestartFlag(): void` - Clear restart state after handling

**Acceptance Criteria:**
- AgentContextManager class created with all methods
- Usage tracking accurately updates and resets
- Threshold checks return correct boolean values
- Pre-request estimation includes conversation + output buffer
- Tool response checking detects overflow correctly
- Restart signaling stores and retrieves tool results

---

#### Task Group 5: Create Pruning Agent
**Dependencies:** Task Groups 2, 3, 4

- [ ] 5.0 Build pruning agent for intelligent conversation compaction
  - [ ] 5.1 Create pruning-agent.ts file
    - Location: `src/agents/pruning-agent.ts`
    - Import Agent, ModelProvider from agent framework
  - [ ] 5.2 Define pruning agent instructions
    - Preservation priorities: system message, current task, recent 3-5 messages, active tool results
    - Compaction strategies: old tool results, completed sub-tasks, redundant messages, long outputs
    - Output format: JSON with `prunedConversation`, `summary`, `originalTokens`, `prunedTokens`
    - Target: 40-60% token reduction
    - See detailed prompt in `planning/04-implementation-strategy.md` lines 390-432
  - [ ] 5.3 Implement createPruningAgent function
    - `async function createPruningAgent(modelProvider: ModelProvider, model: string): Promise<Agent>`
    - Create Agent with pruning instructions
    - Return configured agent instance
  - [ ] 5.4 Implement runPruningAgent function
    - `async function runPruningAgent(messages: any[], contextManager: AgentContextManager, pruningAgentSettings: AgentSettings, options?: { keepToolResult?: string }): Promise<any[]>`
    - Create pruning agent with specified model
    - Prepare input JSON with conversation, currentTokens, contextLimit, keepToolResult
    - Run pruning agent with conversation as input
    - Parse JSON output to extract prunedConversation
    - Log token reduction: originalTokens → prunedTokens
    - Return pruned conversation array
  - [ ] 5.5 Implement fallback truncation on pruning failure
    - Wrap pruning agent run in try-catch
    - On error: Log failure details
    - Fallback: Keep system message + last 5 messages
    - Log warning about fallback usage
    - Return fallback conversation

**Acceptance Criteria:**
- Pruning agent created with comprehensive instructions
- createPruningAgent returns configured agent
- runPruningAgent successfully compacts conversations
- JSON output correctly parsed
- Fallback truncation works when pruning fails
- Token reduction logged for monitoring

---

### Three-Phase Compaction Implementation

#### Task Group 6: Implement Pre-Request Compaction (80% Threshold)
**Dependencies:** Task Groups 4, 5

- [ ] 6.0 Add pre-request compaction before agent execution
  - [ ] 6.1 Locate chat completions endpoint in server
    - File: `src/index.ts` (likely)
    - Find POST `/v1/chat/completions` endpoint handler
  - [ ] 6.2 Add context manager check before agent.run()
    - Check if agent has context manager: `const contextManager = agent.contextManager`
    - Only proceed if `contextManager?.isEnabled()` returns true
  - [ ] 6.3 Update conversation history in context manager
    - Call `contextManager.updateConversationHistory(messages)`
    - Store incoming messages for tracking
  - [ ] 6.4 Estimate input tokens for pre-request check
    - Call `const estimatedTokens = contextManager.estimateInputTokens(messages)`
    - Calculate 80% threshold: `const threshold = contextManager.options.contextLimit * 0.8`
    - Compare estimated tokens to threshold
  - [ ] 6.5 Trigger pruning if over 80% threshold
    - If `estimatedTokens > threshold`:
      - Log: "Pre-request compaction needed: X/Y tokens (Z%)"
      - Call `runPruningAgent(messages, contextManager, agent.settings.pruningAgent)`
      - Replace messages with pruned version
      - Update context manager: `contextManager.updateConversationHistory(prunedMessages)`
      - Log: "Compacted: X → Y tokens"
  - [ ] 6.6 Proceed with agent.run() using compacted messages
    - Use pruned messages if compaction occurred
    - Otherwise use original messages
    - Continue with normal agent execution flow

**Acceptance Criteria:**
- Pre-request compaction runs before agent.run()
- 80% threshold correctly triggers compaction
- Messages replaced with pruned version when needed
- Original messages used if under threshold
- Compaction logged for debugging

---

#### Task Group 7: Implement Tool Response Monitoring
**Dependencies:** Task Groups 4, 5

- [ ] 7.0 Add context checking to tool executions
  - [ ] 7.1 Identify critical tools that may return large results
    - Read file tool (file content)
    - Search tools (search results)
    - List directory tool (file listings)
    - Any tool that reads external data
  - [ ] 7.2 Add context manager check to tool execute functions
    - Get context manager: `const contextManager = context.contextManager as AgentContextManager`
    - Check if enabled: `if (contextManager?.isEnabled())`
    - Skip checks for non-LMStudio agents (no context manager)
  - [ ] 7.3 Call checkBeforeToolResponse before returning result
    - After tool gets result: `const check = contextManager.checkBeforeToolResponse(toolResult)`
    - Extract needsRestart flag from check result
    - If `check.needsRestart === true`: log warning about overflow
  - [ ] 7.4 Mark restart in context manager if needed
    - If needsRestart: `contextManager.markRestartNeeded(toolResult)`
    - Store tool result for preservation during pruning
    - Return tool result normally (agent framework handles it)
  - [ ] 7.5 Implement restart detection in server
    - After agent run or during streaming, check: `if (contextManager.needsRestart())`
    - If restart needed:
      - Get conversation: `const conversation = contextManager.getConversationHistory()`
      - Get tool result: `const toolResult = contextManager.getLastToolResult()`
      - Run pruning agent with keepToolResult option
      - Reset restart flag: `contextManager.resetRestartFlag()`
      - Restart agent with pruned conversation
  - [ ] 7.6 Add restart loop handler with max 3 attempts
    - Create wrapper function: `runAgentWithContextManagement()`
    - Loop: Run agent → Check restart → Prune → Restart
    - Max 3 restart attempts per request
    - Error if pruning doesn't reduce enough after 3 tries
    - Log each restart attempt

**Acceptance Criteria:**
- Critical tools check context before returning large results
- Tool response overflow detected correctly
- Restart signaled to server via context manager state
- Pruning preserves tool result during compaction
- Restart loop prevents infinite restarts (max 3)
- Agent successfully continues after tool overflow

---

#### Task Group 8: Implement Real-Time Streaming Compaction (90% Threshold)
**Dependencies:** Task Groups 4, 5, 6, 7

- [ ] 8.0 Add streaming context monitoring to convertStreamToChunks
  - [ ] 8.1 Locate convertStreamToChunks function
    - File: `src/lib/utils.ts`
    - Function already logs usage data from stream events
  - [ ] 8.2 Add contextManager parameter to function signature
    - Add optional parameter: `contextManager?: AgentContextManager`
    - Add optional parameter: `onCompactionNeeded?: (conversationHistory: any[]) => Promise<any[]>`
  - [ ] 8.3 Extract usage data from stream events
    - Check if event has usage data: `if (contextManager && event.usage)`
    - Extract: `inputTokens`, `outputTokens`, `totalTokens` from event.usage
    - Update context manager: `contextManager.updateUsage({ inputTokens, outputTokens, totalTokens })`
  - [ ] 8.4 Check 90% threshold during streaming
    - Calculate percentage: `const percentage = contextManager.getUsagePercentage()`
    - If `percentage >= 90 && percentage < 100`:
      - Log warning: "90% threshold reached, triggering compaction"
      - Emit compaction message to client: "⚙️ Compacting conversation history..."
      - Signal compaction needed via callback
  - [ ] 8.5 Implement compaction callback handling
    - If `onCompactionNeeded` callback provided:
      - Get conversation: `const conversation = contextManager.getConversationHistory()`
      - Call callback: `const prunedMessages = await onCompactionNeeded(conversation)`
      - Update context manager: `contextManager.updateConversationHistory(prunedMessages)`
      - Reset token counts: `contextManager.reset()`
      - Emit success message: "✅ Context compacted, continuing..."
      - Return from generator to abort current stream
  - [ ] 8.6 Add 100% emergency abort handling
    - If `percentage >= 100`:
      - Log error: "Context limit exceeded, aborting"
      - Emit error message: "⚠️ Context limit exceeded (X/Y tokens). Aborting."
      - Return from generator to abort stream
  - [ ] 8.7 Implement nested stream generator for auto-restart
    - Create `streamWithAutoCompaction()` function (see planning/04-implementation-strategy.md lines 338-380)
    - Wrap agent run + convertStreamToChunks in loop
    - Detect 90% threshold during streaming
    - Run pruning agent on compaction
    - Restart agent with pruned messages
    - Resume streaming to client
    - Max 3 restart attempts
  - [ ] 8.8 Update chat completions endpoint to use auto-restart streaming
    - For streaming requests, use `streamWithAutoCompaction()` instead of direct agent.run()
    - Pass context manager and pruning agent settings
    - Handle max restart attempts gracefully

**Acceptance Criteria:**
- convertStreamToChunks accepts context manager parameter
- Usage data extracted and tracked during streaming
- 90% threshold triggers automatic compaction (not just warning)
- Compaction messages streamed to client
- Nested stream generator restarts agent seamlessly
- 100% emergency abort only triggers if compaction fails
- Max 3 restarts prevents infinite loops

---

### Settings and Integration

#### Task Group 9: Add Pruning Agent Configuration to Settings
**Dependencies:** Task Group 5

- [ ] 9.0 Extend settings UI for pruning agent selection
  - [ ] 9.1 Locate LMStudio provider settings component
    - Find settings UI for LMStudio provider
    - Likely in settings UI components directory
  - [ ] 9.2 Add pruningAgentId field to LMStudioProviderSettings interface
    - Location: Settings types file (e.g., `src/settings/types.ts`)
    - Add: `pruningAgentId?: string`
    - Default value: `'__same__'` (use same model as current agent)
  - [ ] 9.3 Create settings UI field for pruning agent selection
    - Add dropdown/select field to LMStudio settings
    - Label: "Context Pruning Agent"
    - Description: "Agent used to compact conversation history when approaching context limit. Choose a fast, capable model."
    - Options:
      - `{ value: '__same__', label: 'Same as current agent (default)' }`
      - ...all available agents: `{ value: agentId, label: 'AgentName (model)' }`
  - [ ] 9.4 Wire up settings to use pruning agent
    - In agent initialization, read `settings.pruningAgentId`
    - If `'__same__'`: use current agent's model
    - Otherwise: look up specified agent settings
    - Pass pruning agent settings to runPruningAgent function
  - [ ] 9.5 Add settings migration if needed
    - Check if existing settings need migration
    - Add default pruningAgentId to existing LMStudio settings
    - Ensure backwards compatibility

**Acceptance Criteria:**
- Settings UI shows pruning agent dropdown
- Dropdown populated with available agents
- Default option is "Same as current agent"
- Selected pruning agent used during compaction
- Settings persist correctly

---

#### Task Group 10: Integration and Agent Initialization
**Dependencies:** Task Groups 4, 9

- [ ] 10.0 Integrate context manager into agent lifecycle
  - [ ] 10.1 Locate agent initialization code
    - Find where agents are created/initialized
    - Likely in agent management system or server startup
  - [ ] 10.2 Add context manager creation for LMStudio agents only
    - Check if agent's model provider is LMStudio
    - Get model info: `const modelInfo = provider.models.find(m => m.name === agentSettings.model)`
    - Validate context limit exists: throw error if `!modelInfo?.contextLimit`
    - Error message: "Context limit not available for [model]. Please ensure model metadata is correct."
  - [ ] 10.3 Instantiate AgentContextManager for LMStudio agents
    - Create context manager:
      ```typescript
      agent.contextManager = new AgentContextManager(
        {
          enabled: true,
          contextLimit: modelInfo.contextLimit,
          warningThreshold: 0.9,  // 90%
          inputThreshold: 0.8      // 80%
        },
        provider,
        agentSettings.model
      )
      ```
  - [ ] 10.4 Add context manager to agent context for tool access
    - Ensure context manager passed in runner context
    - Tools should access via: `context.contextManager`
  - [ ] 10.5 Wire up pre-request compaction in chat endpoint
    - Integrate Task Group 6 changes into chat completions endpoint
    - Ensure pre-request compaction runs before agent.run()
  - [ ] 10.6 Wire up tool response monitoring
    - Integrate Task Group 7 changes into tool execute functions
    - Ensure restart loop wraps agent execution
  - [ ] 10.7 Wire up streaming compaction
    - Integrate Task Group 8 changes into streaming responses
    - Ensure convertStreamToChunks receives context manager
    - Use nested stream generator for auto-restart
  - [ ] 10.8 Add SSE stream messages for user visibility
    - Compaction start: "⚙️ Compacting conversation history..."
    - Compaction complete: "✅ Context compacted, continuing..."
    - Emergency abort: "⚠️ Context limit exceeded (X/Y tokens). Aborting."
    - Visible in OpenWebUI chat interface automatically

**Acceptance Criteria:**
- Context manager created for LMStudio agents only
- Error thrown if context limit unavailable
- Context manager accessible to tools via context
- All three compaction phases wired into execution flow
- SSE messages visible in client chat interface
- Non-LMStudio agents unaffected by changes

---

## Execution Order

Recommended implementation sequence:

1. **Foundation Layer** (Task Groups 1-2)
   - Install tokenizers
   - Extend base classes

2. **LMStudio Provider** (Task Group 3)
   - Implement token counting with model family detection

3. **Context Management Core** (Task Groups 4-5)
   - Build AgentContextManager class
   - Create pruning agent

4. **Three-Phase Compaction** (Task Groups 6-8)
   - Pre-request compaction (80%)
   - Tool response monitoring (dynamic)
   - Real-time streaming compaction (90%)

5. **Settings and Integration** (Task Groups 9-10)
   - Settings UI for pruning agent
   - Wire up context manager in agent lifecycle

## Testing Strategy

**Manual testing only - no automated tests for MVP**

### Test Scenarios

1. **Pre-request compaction (80%)**
   - Load conversation history to 80% of context
   - Send new message
   - Verify: Compaction runs before agent.run()
   - Verify: Token count reduced by 40-60%

2. **Tool response overflow**
   - Execute read_file tool with large file
   - Verify: Overflow detected before adding to context
   - Verify: Pruning runs, tool result preserved
   - Verify: Agent restarts successfully

3. **Real-time streaming compaction (90%)**
   - Long-running agent generation approaching 90%
   - Verify: Stream pauses at 90%
   - Verify: Compaction message visible in chat
   - Verify: Agent restarts and continues streaming

4. **Multiple consecutive restarts**
   - Multiple large tool results in sequence
   - Verify: Max 3 restarts enforced
   - Verify: Error returned if still over limit after 3 restarts

5. **Pruning agent failure**
   - Simulate pruning agent error (invalid model, etc.)
   - Verify: Fallback truncation used (system + last 5 messages)
   - Verify: Agent continues with fallback

6. **Model family detection**
   - Test with llama3, llama2, mistral, gpt models
   - Verify: Correct tokenizer used per family
   - Verify: Unknown models fall back to gpt-tokenizer

7. **Missing context limit**
   - Use model without context_length in API
   - Verify: Error thrown on agent initialization
   - Verify: Descriptive error message visible

8. **Non-LMStudio agents unaffected**
   - Use Ollama or OpenAI agent
   - Verify: No context manager created
   - Verify: No compaction logic triggered
   - Verify: Normal operation unchanged

## Important Constraints

- **LMStudio only:** Context management ONLY for LMStudio provider
- **No automated tests:** Manual testing only for MVP
- **Hardcoded thresholds:** 80% pre-request, 90% real-time, 100% abort
- **Three-phase defense:** Pre-request, Tool response, Real-time (all required)
- **Tool response monitoring is critical:** Highest priority to prevent "cut middle" behavior
- **Never abort at 100%:** Rely on compaction at 80% and 90% to avoid hitting limit
- **Max 3 restarts:** Prevent infinite compaction loops
- **SSE messages only:** No Obsidian Notice UI for MVP (deferred to websocket feature)

## Dependencies Summary

**New npm packages:**
- llama3-tokenizer-js
- llama-tokenizer-js
- mistral-tokenizer-js

**Existing packages used:**
- gpt-tokenizer (already installed)
- @openai/agents (Runner, Agent)
- hono (SSE streaming)

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `package.json` | MODIFY | Add 3 new tokenizer dependencies |
| `src/models/providers/index.ts` | MODIFY | Add ModelInfo interface, abstract token counting methods |
| `src/models/providers/lmstudio.ts` | MODIFY | Implement tokenizers, model family detection, context limit fetching |
| `src/lib/context-manager.ts` | NEW | AgentContextManager class with usage tracking, threshold checking |
| `src/agents/pruning-agent.ts` | NEW | Pruning agent creation and execution functions |
| `src/lib/utils.ts` | MODIFY | Extend convertStreamToChunks with context monitoring and compaction |
| `src/index.ts` | MODIFY | Add pre-request compaction, restart loop handler, integrate context manager |
| `src/settings/types.ts` | MODIFY | Add pruningAgentId to LMStudioProviderSettings |
| Settings UI component | MODIFY | Add pruning agent dropdown to LMStudio settings |

## Success Criteria

- Conversations with LMStudio models never hit context limit silently
- Users see clear SSE feedback when compaction occurs
- Tool responses that would overflow trigger compaction instead of truncation
- Pruning reduces token count by 40-60% while preserving task context
- Max 3 compaction cycles per request prevents infinite loops
- Token counting accuracy within 1-2% of actual usage for supported model families
- No impact on Ollama or OpenAI provider behavior
- All three compaction phases work seamlessly together
