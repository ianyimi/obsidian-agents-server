# Context Management - Reactive Approach
**Handle Context Limits by Reacting to LM Studio Errors**

## Problem Analysis

You're experiencing **silent middle truncation** from LM Studio, which means:
- LM Studio detects context overflow
- Instead of returning an error, it truncates the middle of the conversation
- Your server never knows this happened
- Model loses critical context mid-conversation

## The Right Solution: Catch LM Studio Errors + Retry with Trimming

### What LM Studio Should Return

Per [OpenAI API spec](https://community.openai.com/t/error-400-maximum-context-length-exceeded/931400), when context exceeds limits:

```json
{
  "error": {
    "message": "This model's maximum context length is 128000 tokens. However, your messages resulted in 135000 tokens.",
    "type": "invalid_request_error",
    "param": "messages",
    "code": "context_length_exceeded"
  }
}
```

**Status:** `400`

### What LM Studio Actually Does

According to [Issue #237](https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues/237):
- Sometimes returns proper error ✅
- Sometimes silently truncates middle ❌
- Error message: "Trying to keep the first X tokens when context overflows. However, the model is loaded with context length of only Y tokens."

## Hybrid Strategy: Reactive + Predictive Fallback

```
┌─────────────────────────────────────────┐
│ 1. Check if we have cached max tokens   │
│    (from previous error)                │
└────────────┬────────────────────────────┘
             │
             ↓
        ┌─────────┐
        │ Have it?│
        └────┬────┘
             │
      ┌──────┴──────┐
      │             │
     Yes           No
      │             │
      ↓             ↓
┌──────────┐  ┌──────────────┐
│ Predict  │  │ Send request │
│ & trim   │  │ to LM Studio │
└────┬─────┘  └──────┬───────┘
     │               │
     │        ┌──────┴──────┐
     │        │             │
     │     Success      Error 400?
     │        │             │
     │        ↓             ↓
     │    ┌─────┐    ┌────────────┐
     │    │Done │    │Parse error │
     │    └─────┘    │for max     │
     │               │tokens      │
     │               └──────┬─────┘
     │                      │
     │               ┌──────┴──────┐
     │               │             │
     │         context_length    Other
     │         exceeded?          error
     │               │             │
     │               ↓             ↓
     │         ┌───────────┐  ┌─────────┐
     │         │Cache max  │  │Return   │
     │         │tokens     │  │error    │
     │         │           │  └─────────┘
     │         │Trim msgs  │
     │         │           │
     │         │Retry once │
     │         └─────┬─────┘
     │               │
     └───────────────┘
                     ↓
              ┌────────────┐
              │ Success or │
              │ give up    │
              └────────────┘
```

---

## Implementation

### Phase 1: Error Detection & Parsing (2 hours)

**File: `src/lib/context-reactive.ts`** (NEW)

```typescript
import { ChatCompletionMessage } from "~/agents/chatCompletionApiTypes"

export interface ContextLimitError {
  detected: boolean
  maxTokens?: number
  actualTokens?: number
  errorMessage?: string
}

export class ReactiveContextManager {
  // Cache of known context limits per model
  private static modelLimits = new Map<string, number>()

  /**
   * Parse LM Studio error to detect context overflow
   */
  static parseContextError(error: any): ContextLimitError {
    if (!error) {
      return { detected: false }
    }

    const errorMessage = error.message || error.error?.message || ''
    const errorCode = error.code || error.error?.code || ''
    const errorType = error.type || error.error?.type || ''

    // Check for OpenAI standard error
    if (errorCode === 'context_length_exceeded' || errorType === 'invalid_request_error') {
      // Parse: "This model's maximum context length is X tokens. However, your messages resulted in Y tokens."
      const maxMatch = errorMessage.match(/maximum context length is (\d+) tokens/)
      const actualMatch = errorMessage.match(/resulted in (\d+) tokens/)

      return {
        detected: true,
        maxTokens: maxMatch ? parseInt(maxMatch[1]) : undefined,
        actualTokens: actualMatch ? parseInt(actualMatch[1]) : undefined,
        errorMessage
      }
    }

    // Check for LM Studio specific error
    if (errorMessage.includes('context overflow') || errorMessage.includes('context length')) {
      // Parse: "Trying to keep the first X tokens when context overflows. However, the model is loaded with context length of only Y tokens."
      const lengthMatch = errorMessage.match(/context length of only (\d+) tokens/)
      const requestedMatch = errorMessage.match(/first (\d+) tokens/)

      return {
        detected: true,
        maxTokens: lengthMatch ? parseInt(lengthMatch[1]) : undefined,
        actualTokens: requestedMatch ? parseInt(requestedMatch[1]) : undefined,
        errorMessage
      }
    }

    return { detected: false }
  }

  /**
   * Cache the context limit for a model
   */
  static cacheModelLimit(modelName: string, maxTokens: number) {
    this.modelLimits.set(modelName, maxTokens)
    console.log(`[Context] Cached limit for ${modelName}: ${maxTokens} tokens`)
  }

  /**
   * Get cached context limit for a model
   */
  static getCachedLimit(modelName: string): number | undefined {
    return this.modelLimits.get(modelName)
  }

  /**
   * Estimate tokens (same as predictive approach)
   */
  static estimateTokens(text: string): number {
    return Math.ceil(text.length / 3.5)
  }

  static estimateMessage(msg: ChatCompletionMessage): number {
    let tokens = 4 // Message overhead

    const content = typeof msg.content === 'string'
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content.map(part => 'text' in part ? part.text : '').join('\n')
        : ''

    tokens += this.estimateTokens(content)

    if (msg.tool_calls) {
      tokens += msg.tool_calls.length * 50
    }

    return tokens
  }

  static estimateTotal(messages: ChatCompletionMessage[]): number {
    return messages.reduce((sum, msg) => sum + this.estimateMessage(msg), 0)
  }

  /**
   * Trim messages to fit within token limit (sliding window)
   */
  static trimToLimit(
    messages: ChatCompletionMessage[],
    maxTokens: number,
    safetyMargin: number = 0.95 // Use 95% of limit
  ): ChatCompletionMessage[] {
    const targetTokens = Math.floor(maxTokens * safetyMargin)

    // Keep system message
    const systemMsg = messages.find(m => m.role === 'system' || m.role === 'developer')

    // Reserve tokens for system message
    let usedTokens = systemMsg ? this.estimateMessage(systemMsg) : 0

    // Work backwards from most recent messages
    const keptMessages: ChatCompletionMessage[] = []

    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]

      // Skip system message (already counted)
      if (msg === systemMsg) continue

      const msgTokens = this.estimateMessage(msg)

      if (usedTokens + msgTokens <= targetTokens) {
        keptMessages.unshift(msg)
        usedTokens += msgTokens
      } else {
        // Stop when we'd exceed limit
        break
      }
    }

    // Build final array
    const result = systemMsg ? [systemMsg, ...keptMessages] : keptMessages

    console.log(`[Context] Trimmed ${messages.length} → ${result.length} messages (${this.estimateTotal(messages)} → ${this.estimateTotal(result)} tokens)`)

    return result
  }
}
```

---

### Phase 2: Integrate Error Catching in Server (3 hours)

**File: `src/index.ts` - Update `/v1/chat/completions` endpoint**

```typescript
import { ReactiveContextManager } from "~/lib/context-reactive"

app.post("/v1/chat/completions", async (c) => {
  try {
    const body = await c.req.json() as CreateChatCompletionBody
    const { model, messages, stream = false } = body

    const agent = Object.values(this.agents).find(a => a.name === model)
    if (!agent) {
      return c.json({
        error: {
          message: `Model '${model}' not found.`,
          type: "invalid_request_error"
        }
      }, 404)
    }

    // Get agent settings
    const agentSettings = this.settings.agents.find(a => a.name === model)

    // NEW: Check if we have cached context limit for this model
    const cachedLimit = ReactiveContextManager.getCachedLimit(model)
    let processedMessages = messages

    if (cachedLimit) {
      // We know the limit from a previous error - proactively trim
      const estimatedTokens = ReactiveContextManager.estimateTotal(messages)

      console.log(`[Context] ${model}: ${estimatedTokens} tokens (limit: ${cachedLimit})`)

      if (estimatedTokens > cachedLimit * 0.9) {
        console.warn(`⚠️ [Context] Approaching cached limit, trimming proactively`)
        processedMessages = ReactiveContextManager.trimToLimit(messages, cachedLimit)
      }
    }

    // Convert messages
    const agentMessages = convertMessagesToAgentInput(processedMessages);

    // NEW: Try the request, catch context errors
    try {
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
          } catch (streamErr: any) {
            console.error('Stream error:', streamErr);

            // NEW: Check if this is a context error during streaming
            const contextError = ReactiveContextManager.parseContextError(streamErr)

            if (contextError.detected) {
              console.error(`[Context] Error during stream: ${contextError.errorMessage}`)

              // Can't retry during streaming - just log it
              // Next request will use cached limit and trim proactively
              if (contextError.maxTokens) {
                ReactiveContextManager.cacheModelLimit(model, contextError.maxTokens)
              }
            }
          }
        });
      }

      // Non-streaming request
      const result = await this.runner.run(agent, agentMessages);
      const response = convertRunResultToCompletion(result, model);
      return c.json(response)

    } catch (runError: any) {
      // NEW: Check if this is a context length error
      const contextError = ReactiveContextManager.parseContextError(runError)

      if (contextError.detected) {
        console.error(`[Context] Context limit exceeded for ${model}`)
        console.error(`[Context] Error: ${contextError.errorMessage}`)

        // Cache the limit for future requests
        if (contextError.maxTokens) {
          ReactiveContextManager.cacheModelLimit(model, contextError.maxTokens)

          // NEW: Auto-retry once with trimmed messages (only if not already trimmed)
          if (processedMessages === messages) {
            console.log(`[Context] Auto-retrying with trimmed messages...`)

            const trimmedMessages = ReactiveContextManager.trimToLimit(
              messages,
              contextError.maxTokens
            )

            if (trimmedMessages.length < messages.length) {
              // Retry with trimmed messages
              const retryAgentMessages = convertMessagesToAgentInput(trimmedMessages)

              try {
                const retryResult = await this.runner.run(agent, retryAgentMessages)
                const retryResponse = convertRunResultToCompletion(retryResult, model)

                console.log(`[Context] ✅ Retry succeeded with ${trimmedMessages.length} messages`)

                return c.json(retryResponse)
              } catch (retryError: any) {
                console.error(`[Context] ❌ Retry failed:`, retryError)
                // Fall through to return error below
              }
            }
          }
        }

        // Return context error to client
        return c.json({
          error: {
            message: contextError.errorMessage || "Context length exceeded",
            type: "context_length_exceeded",
            code: "context_length_exceeded",
            param: "messages",
            details: {
              maxTokens: contextError.maxTokens,
              actualTokens: contextError.actualTokens,
              messagesCount: messages.length,
              trimmedTo: processedMessages.length,
              retryAttempted: processedMessages !== messages
            }
          }
        }, 400)
      }

      // Not a context error - re-throw
      throw runError
    }

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

### Phase 3: Handle Silent Truncation Detection (2 hours)

The tricky part: **What if LM Studio doesn't error but silently truncates?**

**Detection Strategy:**

1. Check response quality indicators
2. Look for signs of context loss
3. Monitor for incomplete responses

**File: `src/lib/context-reactive.ts` (add to existing)**

```typescript
export class ReactiveContextManager {
  // ... existing methods

  /**
   * Detect if response might have had silent truncation
   *
   * Heuristics:
   * - Very short response to long prompt
   * - Response starts mid-sentence
   * - Response seems to have lost context
   */
  static detectSilentTruncation(
    messages: ChatCompletionMessage[],
    response: string,
    modelName: string
  ): boolean {
    // If we don't know the limit yet, can't detect
    const knownLimit = this.getCachedLimit(modelName)
    if (knownLimit) return false // Already handling it

    const estimatedInput = this.estimateTotal(messages)

    // Heuristic 1: Very large input but short response
    if (estimatedInput > 100000 && response.length < 100) {
      console.warn(`[Context] Possible silent truncation: ${estimatedInput} token input, ${response.length} char output`)
      return true
    }

    // Heuristic 2: Response starts with unusual pattern (mid-sentence)
    const suspiciousStarts = [
      /^[a-z]/, // Starts with lowercase (mid-sentence)
      /^\s*\d+\./, // Starts with number (mid-list)
      /^and /i, /^or /i, /^but /i, // Starts with conjunction
    ]

    for (const pattern of suspiciousStarts) {
      if (pattern.test(response.trim())) {
        console.warn(`[Context] Possible silent truncation: response starts with suspicious pattern`)
        return true
      }
    }

    return false
  }

  /**
   * Warn about potential silent truncation
   */
  static warnSilentTruncation(
    modelName: string,
    messages: ChatCompletionMessage[]
  ): string {
    return `⚠️ Warning: The model may have silently truncated your context. ` +
           `Your request had ~${this.estimateTotal(messages)} tokens. ` +
           `Consider reducing conversation history. ` +
           `This detection is heuristic-based and may be inaccurate.`
  }
}
```

**Update response handler:**

```typescript
// After getting response from model
const result = await this.runner.run(agent, agentMessages);
const response = convertRunResultToCompletion(result, model);

// NEW: Check for silent truncation
const responseText = response.choices[0]?.message?.content || ''
const mightBeTruncated = ReactiveContextManager.detectSilentTruncation(
  processedMessages,
  responseText,
  model
)

if (mightBeTruncated) {
  // Add warning to response
  response.choices[0].message.content =
    ReactiveContextManager.warnSilentTruncation(model, processedMessages) +
    "\n\n" + responseText

  // Log for investigation
  console.warn(`[Context] Detected possible silent truncation in response for ${model}`)
}

return c.json(response)
```

---

### Phase 4: Admin Endpoint for Context Management (1 hour)

**File: `src/index.ts` (add new endpoints)**

```typescript
// Get cached context limits
app.get("/v1/context/limits", async (c) => {
  const limits: Record<string, number | undefined> = {}

  for (const agent of this.settings.agents) {
    limits[agent.name] = ReactiveContextManager.getCachedLimit(agent.name)
  }

  return c.json({
    limits,
    note: "These are learned from previous context overflow errors"
  })
})

// Manually set context limit for a model
app.post("/v1/context/limits/:model", async (c) => {
  const modelName = c.req.param('model')
  const body = await c.req.json()
  const maxTokens = body.maxTokens

  if (!maxTokens || typeof maxTokens !== 'number') {
    return c.json({ error: "maxTokens (number) required" }, 400)
  }

  ReactiveContextManager.cacheModelLimit(modelName, maxTokens)

  return c.json({
    success: true,
    model: modelName,
    maxTokens
  })
})

// Clear cached limits
app.delete("/v1/context/limits", async (c) => {
  // Access private map via reflection (or add public method)
  console.log('[Context] Clearing all cached limits')

  return c.json({
    success: true,
    message: "Restart server to clear cached limits"
  })
})
```

---

## Implementation Checklist

### Day 1 (Total: ~7 hours)

**Morning (2 hours):**
- [ ] Create `src/lib/context-reactive.ts`
- [ ] Implement `parseContextError()` - parse LM Studio errors
- [ ] Implement `cacheModelLimit()` - cache learned limits
- [ ] Implement `trimToLimit()` - sliding window trimming
- [ ] Test: Mock error responses, verify parsing

**Afternoon (3 hours):**
- [ ] Update `/v1/chat/completions` endpoint
- [ ] Add try-catch around agent execution
- [ ] Implement error detection logic
- [ ] Implement auto-retry with trimming
- [ ] Test: Force context error, verify retry works

**Evening (2 hours):**
- [ ] Add `detectSilentTruncation()` heuristics
- [ ] Add warning injection for suspected truncation
- [ ] Add admin endpoints for limit management
- [ ] Test: Verify silent truncation detection

---

## Testing Procedure

### Test 1: Error Detection
```bash
# Manually set very low limit for testing
curl -X POST http://localhost:2345/v1/context/limits/Vault%20Agent \
  -H "Content-Type: application/json" \
  -d '{"maxTokens": 5000}'

# Send large request (should trigger error and retry)
curl http://localhost:2345/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d @large-request.json

# Check if limit was cached
curl http://localhost:2345/v1/context/limits
```

### Test 2: Auto-Retry
Watch console logs for:
```
[Context] Context limit exceeded for Vault Agent
[Context] Error: This model's maximum context length is 5000 tokens...
[Context] Cached limit for Vault Agent: 5000 tokens
[Context] Auto-retrying with trimmed messages...
[Context] Trimmed 50 → 15 messages (12000 → 4500 tokens)
[Context] ✅ Retry succeeded with 15 messages
```

### Test 3: Proactive Trimming (Next Request)
```bash
# Second request should proactively trim
curl http://localhost:2345/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d @large-request.json

# Console should show:
# [Context] Vault Agent: 12000 tokens (limit: 5000)
# ⚠️ [Context] Approaching cached limit, trimming proactively
# [Context] Trimmed 50 → 15 messages
```

---

## Advantages Over Predictive Approach

| Aspect | Predictive | Reactive (This Plan) |
|--------|-----------|----------------------|
| **Accuracy** | ±10% estimation error | Exact limits from model |
| **Configuration** | Must manually configure limits | Learns limits automatically |
| **Model Updates** | Must update config if model changes | Adapts automatically |
| **Overhead** | Always calculates tokens | Only on first error |
| **Transparency** | Hidden from user | User sees real error messages |
| **Debugging** | Hard to know real limit | Console shows exact limits |

---

## Error Response Examples

### First Request (Context Error)
```json
{
  "error": {
    "message": "This model's maximum context length is 128000 tokens. However, your messages resulted in 135000 tokens.",
    "type": "context_length_exceeded",
    "code": "context_length_exceeded",
    "param": "messages",
    "details": {
      "maxTokens": 128000,
      "actualTokens": 135000,
      "messagesCount": 67,
      "trimmedTo": 67,
      "retryAttempted": false
    }
  }
}
```

### Auto-Retry Success (After Trimming)
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "choices": [{
    "message": {
      "role": "assistant",
      "content": "Based on the recent conversation..."
    }
  }]
}
```

*Note: Response includes trimmed context but succeeds*

### Subsequent Requests (Proactive)
*Console:*
```
[Context] Vault Agent: 135000 tokens (limit: 128000)
⚠️ [Context] Approaching cached limit, trimming proactively
[Context] Trimmed 67 → 45 messages (135000 → 120000 tokens)
```

*Response:* Normal success (no error seen by client)

---

## Console Logging Examples

### Learning Phase (First Error)
```
[Context] Context limit exceeded for Vault Agent
[Context] Error: This model's maximum context length is 128000 tokens. However, your messages resulted in 135000 tokens.
[Context] Cached limit for Vault Agent: 128000 tokens
[Context] Auto-retrying with trimmed messages...
[Context] Trimmed 67 → 45 messages (135000 → 120000 tokens)
[Context] ✅ Retry succeeded with 45 messages
```

### Learned Phase (Subsequent Requests)
```
[Context] Vault Agent: 135000 tokens (limit: 128000)
⚠️ [Context] Approaching cached limit, trimming proactively
[Context] Trimmed 67 → 45 messages (135000 → 120000 tokens)
```

### Silent Truncation Detection (Heuristic)
```
⚠️ [Context] Possible silent truncation: 120000 token input, 45 char output
[Context] Detected possible silent truncation in response for Vault Agent
```

---

## Configuration (Optional)

Add to `data.json` for manual limits:

```json
{
  "agents": [
    {
      "name": "Vault Agent",
      "contextWindow": {
        "maxTokens": 128000  // Optional: manually set if known
      }
    }
  ]
}
```

If set manually, will use this instead of learning.

---

## Future Enhancements

### 1. Persist Cached Limits
Save learned limits to disk so they survive restart:

```typescript
// On learn
ReactiveContextManager.cacheModelLimit(model, maxTokens)
await plugin.saveData({ contextLimits: ReactiveContextManager.getAllLimits() })

// On startup
const saved = await plugin.loadData()
if (saved.contextLimits) {
  ReactiveContextManager.loadLimits(saved.contextLimits)
}
```

### 2. Smarter Trimming
Instead of sliding window, use importance-based:
- Keep: System message, first user message, last N messages
- Remove: Middle conversation history
- See Phase 3 of CONTEXT_OPTIMIZATION_GUIDE.md

### 3. User Notification
Add to response metadata:
```json
{
  "choices": [...],
  "usage": {...},
  "context_info": {
    "trimmed": true,
    "original_messages": 67,
    "kept_messages": 45,
    "reason": "Approaching context limit"
  }
}
```

---

## Why This Is Better

1. **No Configuration Needed**: Learns limits from real errors
2. **Always Accurate**: Uses exact limits from model
3. **Automatic Retry**: Recovers from first error transparently
4. **Future-Proof**: Adapts when model updates
5. **Transparent**: User sees real errors (if retry fails)
6. **Low Overhead**: Only estimates after learning limit
7. **Handles Silent Truncation**: Detection heuristics (best effort)

---

## Sources

- [LM Studio Context Overflow Issue #237](https://github.com/lmstudio-ai/lmstudio-bug-tracker/issues/237)
- [OpenAI Error 400: Maximum Context Length Exceeded](https://community.openai.com/t/error-400-maximum-context-length-exceeded/931400)
- [Context Length Error Solutions](https://portkey.ai/error-library/context-length-exceeded-error-10046)
- [LM Studio Docs: Get Context Length](https://lmstudio.ai/docs/typescript/model-info/get-context-length)

---

**Total Implementation Time: ~8 hours**
- Day 1: Full reactive system with auto-retry and learning
- Much simpler than predictive approach!
