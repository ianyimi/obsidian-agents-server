# Context Management Implementation Plan
**Stop LM Studio Silent Truncation & Handle Context at Server Level**

## Problem
- LM Studio silently truncates middle of conversation when context exceeds model limits
- Server has no visibility into truncation happening
- Model loses important context mid-conversation
- No predictive warning before hitting limits

## Goal
**Handle ALL context management at the server level before requests reach LM Studio**

## Strategy
1. **Token counting**: Track tokens before sending to model
2. **Smart truncation**: Control what gets removed (not silent middle truncation)
3. **Error handling**: Return errors when context would exceed limits
4. **Configurable limits**: Per-agent context window settings
5. **Sliding window**: Keep recent + important messages

---

## Phase 1: Token Counting & Tracking (Day 1 Morning - 2 hours)

### 1.1 Create Token Estimation Utility

**File: `src/lib/context.ts`**

```typescript
import { ChatCompletionMessage } from "~/agents/chatCompletionApiTypes"

export interface TokenStats {
  messages: number
  estimatedTokens: number
  systemTokens: number
  conversationTokens: number
  percentUsed: number
}

export class ContextManager {
  /**
   * Estimate tokens in text
   * Rule of thumb: 1 token ≈ 4 characters for English text
   * More accurate for structured content: 1 token ≈ 3.5 chars
   */
  static estimateTokens(text: string): number {
    // Simple estimation - could be replaced with tiktoken library later
    return Math.ceil(text.length / 3.5)
  }

  /**
   * Estimate tokens in a single message
   */
  static estimateMessage(msg: ChatCompletionMessage): number {
    let tokens = 4 // Message overhead (role, formatting)

    const content = typeof msg.content === 'string'
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content.map(part => 'text' in part ? part.text : '').join('\n')
        : ''

    tokens += this.estimateTokens(content)

    // Tool calls add extra tokens
    if (msg.tool_calls) {
      tokens += msg.tool_calls.length * 50 // Rough estimate per tool call
    }

    return tokens
  }

  /**
   * Calculate total token usage for message array
   */
  static calculateUsage(
    messages: ChatCompletionMessage[],
    maxContextTokens: number
  ): TokenStats {
    let systemTokens = 0
    let conversationTokens = 0

    for (const msg of messages) {
      const tokens = this.estimateMessage(msg)

      if (msg.role === 'system' || msg.role === 'developer') {
        systemTokens += tokens
      } else {
        conversationTokens += tokens
      }
    }

    const estimatedTokens = systemTokens + conversationTokens
    const percentUsed = Math.round((estimatedTokens / maxContextTokens) * 100)

    return {
      messages: messages.length,
      estimatedTokens,
      systemTokens,
      conversationTokens,
      percentUsed
    }
  }

  /**
   * Check if messages would exceed context limit
   */
  static wouldExceedLimit(
    messages: ChatCompletionMessage[],
    maxContextTokens: number,
    threshold: number = 0.9 // 90% threshold
  ): boolean {
    const stats = this.calculateUsage(messages, maxContextTokens)
    return stats.estimatedTokens > (maxContextTokens * threshold)
  }
}
```

### 1.2 Add Context Settings to Plugin Settings

**File: `src/settings/types.ts`**

```typescript
export interface ObsidianAgentsServerSettings {
  // ... existing fields

  // New context management settings
  contextManagement?: {
    enabled: boolean
    defaultMaxTokens: number // Default: 100000 (safe for 128k models)
    warningThreshold: number // Default: 0.85 (warn at 85%)
    errorThreshold: number // Default: 0.95 (error at 95%)
    maxMessages: number // Default: 50 (sliding window size)
    strategy: 'sliding_window' | 'summarization' | 'manual'
  }
}

export const DEFAULT_SETTINGS: ObsidianAgentsServerSettings = {
  // ... existing defaults

  contextManagement: {
    enabled: true,
    defaultMaxTokens: 100000, // Safe for 128k context models
    warningThreshold: 0.85,
    errorThreshold: 0.95,
    maxMessages: 50,
    strategy: 'sliding_window'
  }
}
```

### 1.3 Add Per-Agent Context Limits

**File: `src/agents/types.ts`**

```typescript
export interface AgentSettings {
  // ... existing fields

  // New context configuration
  contextWindow?: {
    maxTokens?: number // Override default, null = use plugin default
    strategy?: 'sliding_window' | 'summarization' | 'manual'
  }
}
```

---

## Phase 2: Smart Message Trimming (Day 1 Afternoon - 3 hours)

### 2.1 Implement Sliding Window Strategy

**File: `src/lib/context.ts` (add to existing)**

```typescript
export interface TrimResult {
  messages: ChatCompletionMessage[]
  originalCount: number
  trimmedCount: number
  tokensRemoved: number
  strategy: string
}

export class ContextManager {
  // ... existing methods

  /**
   * Sliding window: Keep system message + recent N messages
   */
  static trimSlidingWindow(
    messages: ChatCompletionMessage[],
    maxMessages: number
  ): TrimResult {
    if (messages.length <= maxMessages) {
      return {
        messages,
        originalCount: messages.length,
        trimmedCount: messages.length,
        tokensRemoved: 0,
        strategy: 'none'
      }
    }

    // Find system message
    const systemMsg = messages.find(m =>
      m.role === 'system' || m.role === 'developer'
    )

    // Get recent messages
    const recentMsgs = messages.slice(-maxMessages)

    // Combine: system + recent (excluding system from recent if present)
    const trimmedMessages = systemMsg
      ? [
          systemMsg,
          ...recentMsgs.filter(m =>
            m.role !== 'system' && m.role !== 'developer'
          )
        ]
      : recentMsgs

    // Calculate tokens removed
    const removedMessages = messages.filter(
      m => !trimmedMessages.includes(m)
    )
    const tokensRemoved = removedMessages.reduce(
      (sum, msg) => sum + this.estimateMessage(msg),
      0
    )

    return {
      messages: trimmedMessages,
      originalCount: messages.length,
      trimmedCount: trimmedMessages.length,
      tokensRemoved,
      strategy: 'sliding_window'
    }
  }

  /**
   * Smart trim: Prioritize keeping important messages
   */
  static trimSmart(
    messages: ChatCompletionMessage[],
    maxTokens: number
  ): TrimResult {
    // Keep: system, first user message, last N messages
    const systemMsg = messages.find(m =>
      m.role === 'system' || m.role === 'developer'
    )
    const firstUserMsg = messages.find(m => m.role === 'user')

    // Work backwards from end, accumulating tokens
    const keptMessages: ChatCompletionMessage[] = []
    let tokenCount = 0

    // Reserve tokens for system + first message
    if (systemMsg) tokenCount += this.estimateMessage(systemMsg)
    if (firstUserMsg && firstUserMsg !== systemMsg) {
      tokenCount += this.estimateMessage(firstUserMsg)
    }

    // Add recent messages until we hit limit
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]

      // Skip if already accounted for
      if (msg === systemMsg || msg === firstUserMsg) continue

      const msgTokens = this.estimateMessage(msg)

      if (tokenCount + msgTokens <= maxTokens) {
        keptMessages.unshift(msg)
        tokenCount += msgTokens
      } else {
        break // Stop when we'd exceed limit
      }
    }

    // Build final array: system + first user + recent kept
    const trimmedMessages: ChatCompletionMessage[] = []
    if (systemMsg) trimmedMessages.push(systemMsg)
    if (firstUserMsg && firstUserMsg !== systemMsg) {
      trimmedMessages.push(firstUserMsg)
    }
    trimmedMessages.push(...keptMessages)

    const tokensRemoved = messages.reduce(
      (sum, msg) => sum + this.estimateMessage(msg),
      0
    ) - tokenCount

    return {
      messages: trimmedMessages,
      originalCount: messages.length,
      trimmedCount: trimmedMessages.length,
      tokensRemoved,
      strategy: 'smart'
    }
  }
}
```

---

## Phase 3: Server-Side Context Handling (Day 1 Evening - 2 hours)

### 3.1 Integrate Context Management in Chat Endpoint

**File: `src/index.ts` - Update `/v1/chat/completions` endpoint**

```typescript
app.post("/v1/chat/completions", async (c) => {
  try {
    const body = await c.req.json() as CreateChatCompletionBody
    const { model, messages, stream = false } = body

    const agent = Object.values(this.agents).find(a => a.name === model)
    if (!agent) {
      return c.json({
        error: {
          message: `Model '${model}' not found. Available models: ${Object.values(this.agents).map(a => a.name).join(', ')}`,
          type: "invalid_request_error"
        }
      }, 404)
    }

    // NEW: Get context configuration
    const agentSettings = this.settings.agents.find(a => a.name === model)
    const contextConfig = this.settings.contextManagement
    const maxTokens = agentSettings?.contextWindow?.maxTokens
      || contextConfig?.defaultMaxTokens
      || 100000

    // NEW: Calculate current context usage
    const stats = ContextManager.calculateUsage(messages, maxTokens)

    // NEW: Log context usage
    console.log(`[Context] ${model}:`, {
      messages: stats.messages,
      tokens: stats.estimatedTokens,
      limit: maxTokens,
      usage: `${stats.percentUsed}%`,
      breakdown: {
        system: stats.systemTokens,
        conversation: stats.conversationTokens
      }
    })

    // NEW: Handle context overflow
    let processedMessages = messages

    if (contextConfig?.enabled && stats.estimatedTokens > maxTokens * (contextConfig.errorThreshold || 0.95)) {
      // ERROR: Would definitely exceed limit
      return c.json({
        error: {
          message: `Context limit exceeded: ${stats.estimatedTokens} tokens > ${Math.floor(maxTokens * 0.95)} limit. Please reduce message history or increase context window.`,
          type: "context_length_exceeded",
          code: "context_limit_exceeded",
          param: null,
          details: {
            estimatedTokens: stats.estimatedTokens,
            maxTokens: maxTokens,
            messages: stats.messages
          }
        }
      }, 400)
    }
    else if (contextConfig?.enabled && stats.estimatedTokens > maxTokens * (contextConfig.warningThreshold || 0.85)) {
      // WARNING: Approaching limit, trim messages
      console.warn(`⚠️ [Context] Approaching limit (${stats.percentUsed}%), applying ${contextConfig.strategy}`)

      const trimStrategy = agentSettings?.contextWindow?.strategy || contextConfig.strategy

      if (trimStrategy === 'sliding_window') {
        const trimResult = ContextManager.trimSlidingWindow(
          messages,
          contextConfig.maxMessages || 50
        )

        processedMessages = trimResult.messages

        console.log(`[Context] Trimmed: ${trimResult.originalCount} → ${trimResult.trimmedCount} messages (-${trimResult.tokensRemoved} tokens)`)
      }
      else if (trimStrategy === 'manual') {
        // Return error and let client handle it
        return c.json({
          error: {
            message: `Context warning: ${stats.estimatedTokens} tokens approaching limit of ${maxTokens}. Consider reducing message history.`,
            type: "context_length_warning",
            code: "context_limit_warning",
            param: null,
            details: {
              estimatedTokens: stats.estimatedTokens,
              maxTokens: maxTokens,
              warningThreshold: contextConfig.warningThreshold,
              messages: stats.messages
            }
          }
        }, 400)
      }
    }

    // Continue with processed messages
    const agentMessages = convertMessagesToAgentInput(processedMessages);

    if (stream) {
      const result = await this.runner.run(agent, agentMessages, { stream: true });

      return streamSSE(c, async (stream) => {
        try {
          for await (const chunk of convertStreamToChunks(result, model)) {
            await stream.writeSSE({
              data: JSON.stringify(chunk),
            });
          }
          await stream.writeSSE({
            data: '[DONE]',
          });
        } catch (streamErr) {
          console.error('Stream error:', streamErr);
        }
      });
    }

    const result = await this.runner.run(agent, agentMessages);
    const response = convertRunResultToCompletion(result, model);
    return c.json(response)

  } catch (err: any) {
    console.error('error handling chat completion: ', err)
    return c.json({
      error: {
        message: err?.message ?? "Internal Server Error",
        type: "internal_error"
      }
    }, 500)
  }
})
```

---

## Phase 4: Settings UI (Day 2 Morning - 2 hours)

### 4.1 Add Context Management Settings Tab

**File: `src/settings/context/index.tsx`** (NEW FILE)

```typescript
import { ObsidianAgentsServer } from "~/settings"
import { form } from "~/components/form"

export function ContextSettings({ plugin }: { plugin: ObsidianAgentsServer }) {
  return (
    <form.AppRoot
      plugin={plugin}
      defaultValues={plugin.settings}
      onSubmit={async (values) => {
        plugin.settings = values
        await plugin.saveSettings()
      }}
    >
      {(form) => (
        <div className="space-y-6">
          <h2 className="text-xl font-bold">Context Management</h2>

          <form.AppField
            name="contextManagement.enabled"
            children={(field) => (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={field.state.value}
                  onChange={(e) => field.handleChange(e.target.checked)}
                />
                <label>Enable context management</label>
                <p className="text-sm text-gray-500">
                  Prevent context overflow by managing message history
                </p>
              </div>
            )}
          />

          <form.AppField
            name="contextManagement.defaultMaxTokens"
            children={(field) => (
              <field.TextField
                label="Default Max Tokens"
                description="Default context window size (recommended: 100000 for 128k models)"
                inputProps={{
                  type: "number",
                  value: field.state.value || 100000,
                  onChange: (e) => field.handleChange(Number(e.target.value))
                }}
              />
            )}
          />

          <form.AppField
            name="contextManagement.warningThreshold"
            children={(field) => (
              <field.TextField
                label="Warning Threshold"
                description="Start trimming at this percentage (0.0 - 1.0)"
                inputProps={{
                  type: "number",
                  step: "0.05",
                  min: "0",
                  max: "1",
                  value: field.state.value || 0.85,
                  onChange: (e) => field.handleChange(Number(e.target.value))
                }}
              />
            )}
          />

          <form.AppField
            name="contextManagement.errorThreshold"
            children={(field) => (
              <field.TextField
                label="Error Threshold"
                description="Return error at this percentage (0.0 - 1.0)"
                inputProps={{
                  type: "number",
                  step: "0.05",
                  min: "0",
                  max: "1",
                  value: field.state.value || 0.95,
                  onChange: (e) => field.handleChange(Number(e.target.value))
                }}
              />
            )}
          />

          <form.AppField
            name="contextManagement.maxMessages"
            children={(field) => (
              <field.TextField
                label="Max Messages (Sliding Window)"
                description="Keep this many recent messages when trimming"
                inputProps={{
                  type: "number",
                  value: field.state.value || 50,
                  onChange: (e) => field.handleChange(Number(e.target.value))
                }}
              />
            )}
          />

          <form.AppField
            name="contextManagement.strategy"
            children={(field) => (
              <div>
                <label>Trim Strategy</label>
                <select
                  value={field.state.value || 'sliding_window'}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="w-full p-2 border rounded"
                >
                  <option value="sliding_window">Sliding Window (Keep Recent)</option>
                  <option value="manual">Manual (Return Error)</option>
                  <option value="summarization">Summarization (Future)</option>
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  How to handle context overflow
                </p>
              </div>
            )}
          />

          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Save Context Settings
          </button>
        </div>
      )}
    </form.AppRoot>
  )
}
```

### 4.2 Add Per-Agent Context Override

**File: `src/settings/agents/form.tsx`** (add to existing agent form)

```typescript
// Add to AgentForm component
<div className="space-y-2">
  <h3 className="font-semibold">Context Window</h3>

  <form.AppField
    name="contextWindow.maxTokens"
    children={(field) => (
      <field.TextField
        label="Max Tokens (Override)"
        description="Leave empty to use plugin default"
        inputProps={{
          type: "number",
          placeholder: "Use default",
          value: field.state.value || "",
          onChange: (e) => field.handleChange(e.target.value ? Number(e.target.value) : null)
        }}
      />
    )}
  />

  <form.AppField
    name="contextWindow.strategy"
    children={(field) => (
      <div>
        <label>Strategy (Override)</label>
        <select
          value={field.state.value || ""}
          onChange={(e) => field.handleChange(e.target.value || null)}
          className="w-full p-2 border rounded"
        >
          <option value="">Use default</option>
          <option value="sliding_window">Sliding Window</option>
          <option value="manual">Manual</option>
        </select>
      </div>
    )}
  />
</div>
```

---

## Phase 5: Testing & Monitoring (Day 2 Afternoon - 2 hours)

### 5.1 Add Context Monitoring Endpoint

**File: `src/index.ts` (add new endpoint)**

```typescript
app.get("/v1/context/stats", async (c) => {
  const modelName = c.req.query('model')

  if (!modelName) {
    return c.json({
      error: "Missing 'model' query parameter"
    }, 400)
  }

  const agent = Object.values(this.agents).find(a => a.name === modelName)
  if (!agent) {
    return c.json({
      error: `Model '${modelName}' not found`
    }, 404)
  }

  const agentSettings = this.settings.agents.find(a => a.name === modelName)
  const maxTokens = agentSettings?.contextWindow?.maxTokens
    || this.settings.contextManagement?.defaultMaxTokens
    || 100000

  return c.json({
    model: modelName,
    contextWindow: {
      maxTokens,
      strategy: agentSettings?.contextWindow?.strategy || this.settings.contextManagement?.strategy,
      warningThreshold: this.settings.contextManagement?.warningThreshold || 0.85,
      errorThreshold: this.settings.contextManagement?.errorThreshold || 0.95
    },
    globalSettings: this.settings.contextManagement
  })
})
```

### 5.2 Test Script

**File: `test-context.sh`** (in project root)

```bash
#!/bin/bash

# Test context limit handling

echo "Testing context management..."

# 1. Test normal request
echo -e "\n1. Normal request (should succeed):"
curl -s http://localhost:2345/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Vault Agent",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }' | jq '.choices[0].message.content'

# 2. Test with many messages (should trigger trimming)
echo -e "\n2. Large context (should trigger warning/trim):"

# Build large message array
messages='[{"role": "user", "content": "Start"},'
for i in {1..60}; do
  messages+="{\"role\": \"assistant\", \"content\": \"Response $i\"},"
  messages+="{\"role\": \"user\", \"content\": \"Message $i with some additional content to increase token count\"},"
done
messages+='{\"role\": \"user\", \"content\": \"Final message\"}]'

curl -s http://localhost:2345/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"Vault Agent\",
    \"messages\": $messages
  }" | jq -r '.error // .choices[0].message.content' | head -20

# 3. Check context stats
echo -e "\n3. Context stats for Vault Agent:"
curl -s "http://localhost:2345/v1/context/stats?model=Vault%20Agent" | jq '.'

echo -e "\nTest complete!"
```

---

## Implementation Checklist

### Day 1 Morning (2 hours)
- [ ] Create `src/lib/context.ts` with token estimation
- [ ] Add `estimateTokens()`, `estimateMessage()`, `calculateUsage()`
- [ ] Add context settings to `src/settings/types.ts`
- [ ] Add context window config to agent settings
- [ ] Test: Verify token estimation is working (console.log tests)

### Day 1 Afternoon (3 hours)
- [ ] Add `trimSlidingWindow()` to context manager
- [ ] Add `trimSmart()` to context manager
- [ ] Add `wouldExceedLimit()` check
- [ ] Test: Verify trimming logic with sample messages
- [ ] Test: Ensure system messages are preserved

### Day 1 Evening (2 hours)
- [ ] Update `/v1/chat/completions` endpoint with context handling
- [ ] Add context usage logging
- [ ] Add error responses for context overflow
- [ ] Add warning/trimming at threshold
- [ ] Test: Send oversized context, verify error returned (not silent truncation)
- [ ] Test: Send medium context, verify trimming works

### Day 2 Morning (2 hours)
- [ ] Create `src/settings/context/index.tsx`
- [ ] Add context management settings UI
- [ ] Add per-agent context override in agent settings
- [ ] Update settings tab navigation
- [ ] Test: Verify settings can be changed and saved

### Day 2 Afternoon (2 hours)
- [ ] Add `/v1/context/stats` endpoint
- [ ] Create `test-context.sh` test script
- [ ] Run full test suite
- [ ] Document any issues found
- [ ] Adjust thresholds if needed

---

## Configuration Examples

### Conservative (Small Models or Long Conversations)
```json
{
  "contextManagement": {
    "enabled": true,
    "defaultMaxTokens": 50000,
    "warningThreshold": 0.75,
    "errorThreshold": 0.90,
    "maxMessages": 30,
    "strategy": "sliding_window"
  }
}
```

### Aggressive (Large Models, Short Bursts)
```json
{
  "contextManagement": {
    "enabled": true,
    "defaultMaxTokens": 120000,
    "warningThreshold": 0.90,
    "errorThreshold": 0.98,
    "maxMessages": 100,
    "strategy": "sliding_window"
  }
}
```

### Manual Control (Return Errors, Let Client Handle)
```json
{
  "contextManagement": {
    "enabled": true,
    "defaultMaxTokens": 100000,
    "warningThreshold": 0.85,
    "errorThreshold": 0.95,
    "maxMessages": 50,
    "strategy": "manual"
  }
}
```

---

## Error Response Format

When context limit is exceeded:

```json
{
  "error": {
    "message": "Context limit exceeded: 105000 tokens > 95000 limit. Please reduce message history or increase context window.",
    "type": "context_length_exceeded",
    "code": "context_limit_exceeded",
    "param": null,
    "details": {
      "estimatedTokens": 105000,
      "maxTokens": 100000,
      "messages": 67
    }
  }
}
```

When approaching limit (warning):

```json
{
  "error": {
    "message": "Context warning: 87000 tokens approaching limit of 100000. Consider reducing message history.",
    "type": "context_length_warning",
    "code": "context_limit_warning",
    "param": null,
    "details": {
      "estimatedTokens": 87000,
      "maxTokens": 100000,
      "warningThreshold": 0.85,
      "messages": 52
    }
  }
}
```

---

## Console Output Examples

### Normal Operation
```
[Context] Vault Agent: { messages: 12, tokens: 35000, limit: 100000, usage: "35%" }
```

### Warning (Trimming Applied)
```
⚠️ [Context] Approaching limit (87%), applying sliding_window
[Context] Trimmed: 67 → 50 messages (-15000 tokens)
[Context] Vault Agent: { messages: 50, tokens: 72000, limit: 100000, usage: "72%" }
```

### Error (Overflow)
```
❌ [Context] Limit exceeded: 105000 tokens > 95000 limit
[Context] Returning error to client
```

---

## Future Enhancements (Phase 6+)

### Intelligent Summarization
- Use a fast model to summarize old messages
- Keep summaries instead of full history
- Implement only if sliding window insufficient

### Token Counting Library
- Replace estimation with `tiktoken` or similar
- Get exact token counts per model
- More accurate than character-based estimation

### Context Compression
- Remove redundant information
- Compress tool outputs
- Use pruning agent pattern (see PRUNING_AGENT_PATTERN.md)

### Per-Tool Context Budgets
- Allocate token budget per tool
- Prune tool outputs that exceed budget
- Already documented in your CONTEXT_OPTIMIZATION_GUIDE.md

---

## Key Differences from Current System

| Before | After |
|--------|-------|
| LM Studio silently truncates middle | Server controls what gets removed |
| No visibility into context usage | Full logging and monitoring |
| Truncation happens at model level | Trimming happens at server level |
| No warnings before overflow | Configurable warning/error thresholds |
| No per-agent configuration | Each agent can have custom limits |
| Reactive (after problem occurs) | Predictive (prevent before sending) |

---

## Success Criteria

- ✅ No silent truncation from LM Studio
- ✅ Context errors returned to client with details
- ✅ Configurable thresholds and strategies
- ✅ Per-agent context window overrides
- ✅ Console logging shows context usage
- ✅ Sliding window preserves recent context
- ✅ System messages always preserved
- ✅ Predictive warnings before overflow

---

## Notes

- Token estimation is approximate (±10%) but sufficient for prevention
- Can upgrade to exact counting with `tiktoken` library later
- Sliding window is fastest strategy (no LLM calls)
- Summarization would require additional agent (see PRUNING_AGENT_PATTERN.md)
- Test with your actual model's context window (adjust `defaultMaxTokens`)
- Error thresholds should be < 1.0 to account for estimation error

---

## Testing Procedure

1. **Enable context management** in settings
2. **Set low maxTokens** (e.g., 5000) for testing
3. **Send increasing message counts** until error occurs
4. **Verify error is returned** (not silent truncation)
5. **Check console logs** for trimming messages
6. **Verify sliding window works** (check which messages kept)
7. **Test per-agent overrides** work correctly
8. **Restore production settings** when done

---

**Total Implementation Time: ~11 hours**
- Day 1: ~7 hours (token counting, trimming, server integration)
- Day 2: ~4 hours (UI, monitoring, testing)
