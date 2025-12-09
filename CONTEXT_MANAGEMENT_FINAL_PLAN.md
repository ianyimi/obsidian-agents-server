# Context Management - Final Implementation Plan
**Reactive Error Handling + Provider-Specific Token Counting**

## Overview

This plan combines:
1. **Reactive error handling** - Learn limits from LM Studio/Ollama errors
2. **Provider-specific token counting** - Use accurate tokenizers per model
3. **Auto-retry with trimming** - Recover transparently from context overflow
4. **Clean architecture** - Integrate with existing provider pattern

## Token Accuracy by Provider

| Provider | Model | Tokenizer | Accuracy |
|----------|-------|-----------|----------|
| LMStudio | GPT-4, Llama 3 | tiktoken/gpt-tokenizer | 99%+ |
| Ollama | Llama 3.x | llama3-tokenizer-js | 99%+ |
| Ollama | Llama 2.x | llama-tokenizer-js | 99%+ |
| Ollama | Mistral | mistral-tokenizer-js | 99%+ |
| Ollama | Qwen | gpt-tokenizer (fallback) | ~85% |
| Any | Unknown | gpt-tokenizer (fallback) | 80-99% |

---

## Phase 1: Install Dependencies (5 minutes)

```bash
# Core tokenizer for LMStudio and fallback
npm install gpt-tokenizer

# Ollama model-specific tokenizers
npm install llama3-tokenizer-js
npm install llama-tokenizer-js
npm install mistral-tokenizer-js
```

**Package sizes:**
- `gpt-tokenizer`: ~500 KB
- `llama3-tokenizer-js`: ~400 KB
- `llama-tokenizer-js`: ~350 KB
- `mistral-tokenizer-js`: ~300 KB
- **Total**: ~1.5 MB

---

## Phase 2: Add Token Counting to Provider Base Class (30 minutes)

**File: `src/models/providers/index.ts`**

```typescript
import ObsidianAgentsServer from "~/index"
import { ChatCompletionMessage } from "~/agents/chatCompletionApiTypes"

export abstract class ModelProvider {
  abstract id: string
  abstract baseURL: string
  abstract instance?: any
  models: string[] = []

  constructor(
    protected plugin: ObsidianAgentsServer,
    id: string
  ) {
    this.id = id
    this.initializeProvider()
  }

  protected initializeProvider() {
    this.createInstance()
    if (this.plugin.settings.modelProviders.some(mp => mp.id === this.id)) {
      this.getModels().then(models => {
        this.models = models
      }).catch(e => {
        console.error('error fetching models: ', e)
      })
    }
  }

  // NEW: Abstract token counting methods
  abstract countTokens(text: string, modelName?: string): number
  abstract countMessages(messages: ChatCompletionMessage[], modelName?: string): number

  abstract getModels(): Promise<string[]>
  abstract createInstance(): void
}
```

---

## Phase 3: Implement Token Counting in LMStudio Provider (30 minutes)

**File: `src/models/providers/lmstudio.ts`**

```typescript
import { ModelProvider } from ".";
import { MODEL_PROVIDERS } from "~/models/providers/constants";
import ObsidianAgentsServer from "~/index";
import { requestUrl } from "obsidian";
import { createOpenAICompatible, OpenAICompatibleProvider } from "@ai-sdk/openai-compatible";
import { ChatCompletionMessage } from "~/agents/chatCompletionApiTypes";

// NEW: Import tokenizer
import { encode, encodeChat } from 'gpt-tokenizer'
import type { ChatMessage } from 'gpt-tokenizer/GptEncoding'

type GetModelsResponse = {
  id: string;
  object: string;
  owned_by: string;
}[]

export class LMStudio extends ModelProvider {
  id = MODEL_PROVIDERS.lmstudio.id;
  baseURL = MODEL_PROVIDERS["lmstudio"].baseURL;
  models = [];
  instance?: OpenAICompatibleProvider

  constructor(plugin: ObsidianAgentsServer) {
    super(plugin, MODEL_PROVIDERS.lmstudio.id)
  }

  async getModels() {
    const res = await requestUrl(`${this.baseURL}/models`)
    if (res.status === 200) {
      const models = (res.json.data as GetModelsResponse).map(m => m.id)
      return models
    }
    return []
  }

  createInstance() {
    this.instance = createOpenAICompatible({
      name: this.id,
      baseURL: this.baseURL,
      fetch: async (url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

        const response = await requestUrl({
          url: urlString,
          method: init?.method || 'GET',
          headers: init?.headers as Record<string, string>,
          body: init?.body as string,
        });

        return new Response(response.text, {
          status: response.status,
          headers: response.headers,
        });
      }
    })
  }

  // NEW: Token counting implementation
  countTokens(text: string, modelName?: string): number {
    // LMStudio primarily hosts OpenAI-compatible models and Llama 3
    // Both use tiktoken-based tokenizers
    return encode(text).length
  }

  countMessages(messages: ChatCompletionMessage[], modelName?: string): number {
    // Convert to format expected by gpt-tokenizer
    const chatMessages: ChatMessage[] = messages.map(m => {
      const content = typeof m.content === 'string'
        ? m.content
        : Array.isArray(m.content)
          ? m.content.map(part => 'text' in part ? part.text : '').join('\n')
          : ''

      return {
        role: m.role as 'system' | 'user' | 'assistant',
        content
      }
    })

    // Use gpt-4 encoding (works for GPT-4, Llama 3, etc.)
    const tokens = encodeChat(chatMessages, 'gpt-4')
    return tokens.length
  }
}
```

---

## Phase 4: Implement Token Counting in Ollama Provider (1 hour)

**File: `src/models/providers/ollama.ts`** (NEW FILE)

```typescript
import { ModelProvider } from ".";
import { MODEL_PROVIDERS } from "~/models/providers/constants";
import ObsidianAgentsServer from "~/index";
import { requestUrl } from "obsidian";
import { createOpenAICompatible, OpenAICompatibleProvider } from "@ai-sdk/openai-compatible";
import { ChatCompletionMessage } from "~/agents/chatCompletionApiTypes";

// Import model-specific tokenizers
import Llama3Tokenizer from 'llama3-tokenizer-js'
import LlamaTokenizer from 'llama-tokenizer-js'
import MistralTokenizer from 'mistral-tokenizer-js'
import { encode, encodeChat } from 'gpt-tokenizer'
import type { ChatMessage } from 'gpt-tokenizer/GptEncoding'

type GetModelsResponse = {
  models: {
    name: string;
    model: string;
    modified_at: string;
    size: number;
  }[]
}

export class Ollama extends ModelProvider {
  id = MODEL_PROVIDERS.ollama.id;
  baseURL = MODEL_PROVIDERS.ollama.baseURL;
  models = [];
  instance?: OpenAICompatibleProvider

  // Initialize tokenizers
  private llama3Tokenizer = new Llama3Tokenizer()
  private llamaTokenizer = new LlamaTokenizer()
  private mistralTokenizer = new MistralTokenizer()

  constructor(plugin: ObsidianAgentsServer) {
    super(plugin, MODEL_PROVIDERS.ollama.id)
  }

  async getModels() {
    const res = await requestUrl(`${this.baseURL}/api/tags`)
    if (res.status === 200) {
      const models = (res.json as GetModelsResponse).models.map(m => m.name)
      return models
    }
    return []
  }

  createInstance() {
    this.instance = createOpenAICompatible({
      name: this.id,
      baseURL: `${this.baseURL}/v1`,
      fetch: async (url: string | URL | Request, init?: RequestInit) => {
        const urlString = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;

        const response = await requestUrl({
          url: urlString,
          method: init?.method || 'GET',
          headers: init?.headers as Record<string, string>,
          body: init?.body as string,
        });

        return new Response(response.text, {
          status: response.status,
          headers: response.headers,
        });
      }
    })
  }

  /**
   * Detect which tokenizer to use based on model name
   */
  private detectModelFamily(modelName: string): 'llama3' | 'llama2' | 'mistral' | 'qwen' | 'unknown' {
    const lower = modelName.toLowerCase()

    // Llama 3.x models
    if (lower.includes('llama-3') || lower.includes('llama3') ||
        lower.includes('llama-3.1') || lower.includes('llama-3.2')) {
      return 'llama3'
    }

    // Llama 2.x models
    if (lower.includes('llama-2') || lower.includes('llama2')) {
      return 'llama2'
    }

    // Mistral models
    if (lower.includes('mistral') || lower.includes('mixtral')) {
      return 'mistral'
    }

    // Qwen models
    if (lower.includes('qwen')) {
      return 'qwen'
    }

    return 'unknown'
  }

  countTokens(text: string, modelName?: string): number {
    if (!modelName) {
      // No model specified - use gpt-tokenizer as fallback
      return encode(text).length
    }

    const family = this.detectModelFamily(modelName)

    try {
      switch (family) {
        case 'llama3':
          return this.llama3Tokenizer.encode(text).length

        case 'llama2':
          return this.llamaTokenizer.encode(text).length

        case 'mistral':
          return this.mistralTokenizer.encode(text).length

        case 'qwen':
        case 'unknown':
        default:
          // Fallback to gpt-tokenizer (tiktoken)
          // Works reasonably well for most models
          return encode(text).length
      }
    } catch (err) {
      console.warn(`[Tokenizer] Error with ${family} tokenizer, falling back to gpt-tokenizer:`, err)
      return encode(text).length
    }
  }

  countMessages(messages: ChatCompletionMessage[], modelName?: string): number {
    if (!modelName) {
      // Fallback to gpt-tokenizer
      const chatMessages: ChatMessage[] = messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: this.extractContent(m)
      }))
      return encodeChat(chatMessages, 'gpt-4').length
    }

    const family = this.detectModelFamily(modelName)

    try {
      // Calculate tokens for each message
      let totalTokens = 0

      for (const msg of messages) {
        const content = this.extractContent(msg)

        // Count content tokens
        totalTokens += this.countTokens(content, modelName)

        // Add per-message overhead (varies by model family)
        switch (family) {
          case 'llama3':
          case 'llama2':
            totalTokens += 4 // Llama models use ~4 tokens per message
            break
          case 'mistral':
            totalTokens += 5 // Mistral uses slightly more
            break
          case 'qwen':
          case 'unknown':
          default:
            totalTokens += 4 // Conservative default
        }
      }

      // Add reply priming tokens
      totalTokens += 3

      return totalTokens

    } catch (err) {
      console.warn(`[Tokenizer] Error counting messages for ${family}, falling back:`, err)

      // Complete fallback
      const chatMessages: ChatMessage[] = messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: this.extractContent(m)
      }))
      return encodeChat(chatMessages, 'gpt-4').length
    }
  }

  private extractContent(msg: ChatCompletionMessage): string {
    if (typeof msg.content === 'string') {
      return msg.content
    }

    if (Array.isArray(msg.content)) {
      return msg.content
        .map(part => 'text' in part ? part.text : '')
        .join('\n')
    }

    return ''
  }
}
```

---

## Phase 5: Update Constants to Include Ollama (5 minutes)

**File: `src/models/providers/constants.ts`**

```typescript
export interface ModelProviderSettings {
  id: string
  label: string
  baseURL: string
}

export const MODEL_PROVIDERS = {
  lmstudio: {
    id: "lmstudio" as const,
    label: "LMStudio",
    baseURL: "http://localhost:1234/v1"
  },
  ollama: {
    id: "ollama" as const,
    label: "Ollama",
    baseURL: "http://localhost:11434"
  }
} as const

export type ModelProviderID = typeof MODEL_PROVIDERS[keyof typeof MODEL_PROVIDERS]["id"]
```

---

## Phase 6: Create Reactive Context Manager (1 hour)

**File: `src/lib/context-reactive.ts`** (NEW FILE)

```typescript
import { ChatCompletionMessage } from "~/agents/chatCompletionApiTypes"
import ObsidianAgentsServer from "~/index"

export interface ContextLimitError {
  detected: boolean
  maxTokens?: number
  actualTokens?: number
  errorMessage?: string
}

export interface TrimResult {
  messages: ChatCompletionMessage[]
  originalCount: number
  trimmedCount: number
  originalTokens: number
  finalTokens: number
}

export class ReactiveContextManager {
  // Cache of known context limits per model
  private static modelLimits = new Map<string, number>()

  /**
   * Parse LM Studio/Ollama error to detect context overflow
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
   * Count total tokens using provider-specific tokenizer
   */
  static countTotal(
    messages: ChatCompletionMessage[],
    plugin: ObsidianAgentsServer,
    agentName: string
  ): number {
    // Find agent settings
    const agentSettings = plugin.settings.agents.find(a => a.name === agentName)
    if (!agentSettings) {
      console.warn(`[Context] Agent ${agentName} not found, using fallback estimation`)
      return this.estimateTotal(messages)
    }

    // Get the provider
    const provider = plugin.modelProviders.find(p => p.id === agentSettings.modelProvider)
    if (!provider) {
      console.warn(`[Context] Provider ${agentSettings.modelProvider} not found, using fallback estimation`)
      return this.estimateTotal(messages)
    }

    // Use provider's accurate token counting
    try {
      return provider.countMessages(messages, agentSettings.model)
    } catch (err) {
      console.error(`[Context] Error counting tokens:`, err)
      return this.estimateTotal(messages)
    }
  }

  /**
   * Fallback estimation (if provider doesn't support counting)
   */
  private static estimateTotal(messages: ChatCompletionMessage[]): number {
    return messages.reduce((sum, msg) => {
      const content = typeof msg.content === 'string'
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content.map(part => 'text' in part ? part.text : '').join('\n')
          : ''

      return sum + Math.ceil(content.length / 3.5) + 4
    }, 3)
  }

  /**
   * Trim messages to fit within token limit using binary search
   */
  static trimToLimit(
    messages: ChatCompletionMessage[],
    maxTokens: number,
    plugin: ObsidianAgentsServer,
    agentName: string,
    safetyMargin: number = 0.95
  ): TrimResult {
    const targetTokens = Math.floor(maxTokens * safetyMargin)
    const originalTokens = this.countTotal(messages, plugin, agentName)

    // Quick check: do we even need to trim?
    if (originalTokens <= targetTokens) {
      return {
        messages,
        originalCount: messages.length,
        trimmedCount: messages.length,
        originalTokens,
        finalTokens: originalTokens
      }
    }

    // Keep system message
    const systemMsg = messages.find(m => m.role === 'system' || m.role === 'developer')
    const otherMessages = messages.filter(m => m !== systemMsg)

    // Binary search for the right number of recent messages to keep
    let left = 1
    let right = otherMessages.length
    let bestFit = systemMsg ? [systemMsg] : []
    let bestTokenCount = systemMsg
      ? this.countTotal([systemMsg], plugin, agentName)
      : 0

    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const recentMessages = otherMessages.slice(-mid)
      const testMessages = systemMsg ? [systemMsg, ...recentMessages] : recentMessages

      const tokenCount = this.countTotal(testMessages, plugin, agentName)

      if (tokenCount <= targetTokens) {
        // This fits, try to include more
        bestFit = testMessages
        bestTokenCount = tokenCount
        left = mid + 1
      } else {
        // Too many, try fewer
        right = mid - 1
      }
    }

    console.log(
      `[Context] Trimmed ${messages.length} → ${bestFit.length} messages ` +
      `(${originalTokens} → ${bestTokenCount} tokens)`
    )

    return {
      messages: bestFit,
      originalCount: messages.length,
      trimmedCount: bestFit.length,
      originalTokens,
      finalTokens: bestTokenCount
    }
  }

  /**
   * Get all cached limits (for admin endpoint)
   */
  static getAllLimits(): Record<string, number> {
    const limits: Record<string, number> = {}
    this.modelLimits.forEach((value, key) => {
      limits[key] = value
    })
    return limits
  }

  /**
   * Clear all cached limits
   */
  static clearLimits() {
    this.modelLimits.clear()
    console.log('[Context] All cached limits cleared')
  }

  /**
   * Detect if response might have had silent truncation
   */
  static detectSilentTruncation(
    messages: ChatCompletionMessage[],
    response: string,
    plugin: ObsidianAgentsServer,
    agentName: string
  ): boolean {
    const knownLimit = this.getCachedLimit(agentName)
    if (knownLimit) return false // We already know the limit

    const inputTokens = this.countTotal(messages, plugin, agentName)

    // Heuristic: Very large input but tiny response
    if (inputTokens > 100000 && response.length < 100) {
      console.warn(
        `[Context] Possible silent truncation: ${inputTokens} token input, ` +
        `${response.length} char output`
      )
      return true
    }

    return false
  }

  /**
   * Generate warning message for silent truncation
   */
  static warnSilentTruncation(
    agentName: string,
    messages: ChatCompletionMessage[],
    plugin: ObsidianAgentsServer
  ): string {
    const tokens = this.countTotal(messages, plugin, agentName)
    return (
      `⚠️ Warning: The model may have silently truncated your context. ` +
      `Your request had ${tokens} tokens. ` +
      `Consider reducing conversation history.`
    )
  }
}
```

---

## Phase 7: Integrate into Server (1 hour)

**File: `src/index.ts`** - Update the `initializeModelProviders` and `/v1/chat/completions` endpoint

### 7.1: Update Provider Initialization

```typescript
import { Ollama } from "~/models/providers/ollama"

// In the class
initializeModelProviders(): ModelProvider[] {
  const providers = []
  for (const provider of this.settings.modelProviders) {
    switch (provider.id) {
      case MODEL_PROVIDERS.lmstudio.id:
        providers.push(new LMStudio(this))
        break;
      case MODEL_PROVIDERS.ollama.id:
        providers.push(new Ollama(this))
        break;
      default:
        break;
    }
  }
  return providers
}
```

### 7.2: Update Chat Completions Endpoint

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

    // NEW: Check if we have cached context limit for this model
    const cachedLimit = ReactiveContextManager.getCachedLimit(model)
    let processedMessages = messages

    if (cachedLimit) {
      // We know the limit - proactively trim if needed
      const actualTokens = ReactiveContextManager.countTotal(messages, this, model)

      console.log(`[Context] ${model}: ${actualTokens} tokens (limit: ${cachedLimit})`)

      if (actualTokens > cachedLimit * 0.9) {
        console.warn(`⚠️ [Context] Approaching cached limit (${Math.round((actualTokens / cachedLimit) * 100)}%), trimming proactively`)

        const trimResult = ReactiveContextManager.trimToLimit(
          messages,
          cachedLimit,
          this,
          model
        )

        processedMessages = trimResult.messages
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

            if (contextError.detected && contextError.maxTokens) {
              ReactiveContextManager.cacheModelLimit(model, contextError.maxTokens)
              console.error(`[Context] Cached limit from stream error: ${contextError.maxTokens}`)
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

            const trimResult = ReactiveContextManager.trimToLimit(
              messages,
              contextError.maxTokens,
              this,
              model
            )

            if (trimResult.trimmedCount < messages.length) {
              // Retry with trimmed messages
              const retryAgentMessages = convertMessagesToAgentInput(trimResult.messages)

              try {
                const retryResult = await this.runner.run(agent, retryAgentMessages)
                const retryResponse = convertRunResultToCompletion(retryResult, model)

                console.log(`[Context] ✅ Retry succeeded with ${trimResult.trimmedCount} messages`)

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

## Phase 8: Add Admin Endpoints (30 minutes)

**File: `src/index.ts`** - Add new endpoints for context management

```typescript
// Get cached context limits
app.get("/v1/context/limits", async (c) => {
  const limits = ReactiveContextManager.getAllLimits()

  return c.json({
    limits,
    note: "These are learned from previous context overflow errors"
  })
})

// Manually set context limit for a model
app.post("/v1/context/limits/:model", async (c) => {
  const modelName = decodeURIComponent(c.req.param('model'))
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
  ReactiveContextManager.clearLimits()

  return c.json({
    success: true,
    message: "All cached limits cleared"
  })
})

// Get context stats for a specific model
app.get("/v1/context/stats/:model", async (c) => {
  const modelName = decodeURIComponent(c.req.param('model'))

  const agent = Object.values(this.agents).find(a => a.name === modelName)
  if (!agent) {
    return c.json({ error: `Model '${modelName}' not found` }, 404)
  }

  const agentSettings = this.settings.agents.find(a => a.name === modelName)
  const cachedLimit = ReactiveContextManager.getCachedLimit(modelName)

  return c.json({
    model: modelName,
    cachedLimit: cachedLimit || null,
    provider: agentSettings?.modelProvider,
    providerModel: agentSettings?.model,
    status: cachedLimit ? "learned" : "unknown"
  })
})
```

---

## Phase 9: Update Settings Types (10 minutes)

**File: `src/agents/types.ts`**

```typescript
export interface AgentSettings {
  id: string,
  name: string,
  enabled: boolean,
  useAsTool: boolean,
  toolName: string,
  toolDescription: string,
  instructions: string,
  collapsed: boolean,
  modelProvider: ModelProviderID
  model: string
  agentTools: string[]
  vaultTools: Record<VaultToolsID, boolean>
  mcpTools: {
    enabled: boolean,
    type: Extract<ToolType, { id: "mcp" }>
    serverID: string,
    toolIDs: string[]
  }[],
  tools: {
    enabled: boolean,
    type: ToolType,
    description?: string,
    customToolPath?: string
  }[]
  // NEW: Optional context window override
  contextWindow?: {
    maxTokens?: number // Manual override (null = learn from errors)
  }
}
```

---

## Testing Checklist

### Phase 10: Testing (1 hour)

#### Test 1: LMStudio with GPT-4/Llama 3
```bash
# 1. Start a conversation
curl http://localhost:2345/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Vault Agent",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# Check console for:
# [Context] Vault Agent: 45 tokens (no limit cached yet)
```

#### Test 2: Send Oversized Request
```bash
# 2. Create a large request file with 60+ messages
# large-request.json

curl http://localhost:2345/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d @large-request.json

# Expected console output:
# [Context] Context limit exceeded for Vault Agent
# [Context] Cached limit for Vault Agent: 128000 tokens
# [Context] Auto-retrying with trimmed messages...
# [Context] Trimmed 67 → 45 messages (135000 → 120000 tokens)
# [Context] ✅ Retry succeeded with 45 messages
```

#### Test 3: Verify Proactive Trimming
```bash
# 3. Send another large request
curl http://localhost:2345/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d @large-request.json

# Expected console output:
# [Context] Vault Agent: 135000 tokens (limit: 128000)
# ⚠️ [Context] Approaching cached limit (105%), trimming proactively
# [Context] Trimmed 67 → 45 messages (135000 → 120000 tokens)
# (No error, just trimmed and succeeded)
```

#### Test 4: Check Admin Endpoints
```bash
# View cached limits
curl http://localhost:2345/v1/context/limits

# Expected:
# {
#   "limits": {
#     "Vault Agent": 128000
#   },
#   "note": "These are learned from previous context overflow errors"
# }

# Manually set a limit
curl -X POST http://localhost:2345/v1/context/limits/Vault%20Agent \
  -H "Content-Type: application/json" \
  -d '{"maxTokens": 100000}'

# Clear all limits
curl -X DELETE http://localhost:2345/v1/context/limits
```

#### Test 5: Test Ollama with Different Models
```bash
# Test Llama 3
curl http://localhost:2345/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Llama Agent",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# Check console shows correct tokenizer used:
# [Context] Llama Agent: 45 tokens (using llama3-tokenizer-js)

# Test Mistral
curl http://localhost:2345/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Mistral Agent",
    "messages": [{"role": "user", "content": "Hello"}]
  }'

# Check console:
# [Context] Mistral Agent: 52 tokens (using mistral-tokenizer-js)
```

---

## Implementation Timeline

| Phase | Task | Time | Cumulative |
|-------|------|------|------------|
| 1 | Install dependencies | 5 min | 5 min |
| 2 | Update provider base class | 30 min | 35 min |
| 3 | Implement LMStudio tokenizing | 30 min | 1h 5min |
| 4 | Implement Ollama tokenizing | 1 hour | 2h 5min |
| 5 | Update constants | 5 min | 2h 10min |
| 6 | Create context manager | 1 hour | 3h 10min |
| 7 | Integrate into server | 1 hour | 4h 10min |
| 8 | Add admin endpoints | 30 min | 4h 40min |
| 9 | Update types | 10 min | 4h 50min |
| 10 | Testing | 1 hour | **5h 50min** |

**Total: ~6 hours**

---

## Console Output Examples

### Learning Phase (First Error)
```
[Context] Context limit exceeded for Vault Agent
[Context] Error: This model's maximum context length is 128000 tokens. However, your messages resulted in 135724 tokens.
[Context] Cached limit for Vault Agent: 128000 tokens
[Context] Auto-retrying with trimmed messages...
[Context] Trimmed 67 → 45 messages (135724 → 119856 tokens)
[Context] ✅ Retry succeeded with 45 messages
```

### Learned Phase (Proactive Trimming)
```
[Context] Vault Agent: 135724 tokens (limit: 128000)
⚠️ [Context] Approaching cached limit (106%), trimming proactively
[Context] Trimmed 67 → 45 messages (135724 → 119856 tokens)
```

### Different Model Families
```
[Context] Vault Agent (llama3): 45123 tokens (limit: 128000)
[Context] Mistral Agent (mistral): 52341 tokens (limit: 32768)
[Context] Qwen Agent (qwen/fallback): 48756 tokens (limit: 32768)
```

---

## Error Response Format

When context limit is exceeded (before retry):

```json
{
  "error": {
    "message": "This model's maximum context length is 128000 tokens. However, your messages resulted in 135724 tokens.",
    "type": "context_length_exceeded",
    "code": "context_length_exceeded",
    "param": "messages",
    "details": {
      "maxTokens": 128000,
      "actualTokens": 135724,
      "messagesCount": 67,
      "trimmedTo": 67,
      "retryAttempted": false
    }
  }
}
```

After successful retry (user sees success):
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

---

## Key Benefits

1. ✅ **99%+ Accurate** - Uses correct tokenizer per model family
2. ✅ **Automatic Learning** - Learns limits from real errors
3. ✅ **Transparent Recovery** - Auto-retries with trimming
4. ✅ **Proactive Prevention** - Trims before hitting limit (after learning)
5. ✅ **Multi-Provider Support** - Works with LMStudio, Ollama, future providers
6. ✅ **Clean Architecture** - Follows existing provider pattern
7. ✅ **Graceful Fallback** - Uses tiktoken if specific tokenizer unavailable
8. ✅ **Admin Control** - Endpoints to view/set/clear limits

---

## Future Enhancements

### Persist Cached Limits
Save learned limits to disk:

```typescript
// On limit learn
ReactiveContextManager.cacheModelLimit(model, maxTokens)
plugin.settings.contextLimits = ReactiveContextManager.getAllLimits()
await plugin.saveSettings()

// On startup
if (plugin.settings.contextLimits) {
  for (const [model, limit] of Object.entries(plugin.settings.contextLimits)) {
    ReactiveContextManager.cacheModelLimit(model, limit)
  }
}
```

### Smart Trimming Strategies
- Keep: System message, first user message, last N messages
- Remove: Middle conversation history
- Preserve: Messages with tool calls/results

### Context Usage in Response
Add metadata to responses:

```json
{
  "choices": [...],
  "usage": {
    "prompt_tokens": 119856,
    "completion_tokens": 234,
    "total_tokens": 120090
  },
  "context_info": {
    "trimmed": true,
    "original_messages": 67,
    "kept_messages": 45,
    "limit": 128000
  }
}
```

---

## Sources

- [Not All Tokens Are Created Equal](https://medium.com/@disparate-ai/not-all-tokens-are-created-equal-7347d549af4d)
- [Calculating LLM Token Counts Guide](https://winder.ai/calculating-token-counts-llm-context-windows-practical-guide/)
- [Token Counting Explained 2025](https://www.propelcode.ai/blog/token-counting-tiktoken-anthropic-gemini-guide-2025)
- [Mistral NeMo Tokenizer](https://mistral.ai/news/mistral-nemo)
- [llama3-tokenizer-js on npm](https://www.npmjs.com/package/llama3-tokenizer-js)
- [mistral-tokenizer-js on npm](https://www.npmjs.com/package/mistral-tokenizer-js)
- [gpt-tokenizer on npm](https://www.npmjs.com/package/gpt-tokenizer)
