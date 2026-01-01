# Context Management Plan - Using OpenAI Agents SDK Usage Tracking

## Overview
With the OpenAI agents SDK now providing usage tracking during streaming (via the recent PR), we can read usage data directly from the stream events. This plan focuses on context management and user feedback rather than manual token counting.

## Strategy

### 1. Two-Phase Token Management

#### Phase A: Input Estimation (Before Request)
- **Estimate input tokens** using tokenizer library (still needed!)
- **Check against limit** before sending to model
- **Proactive trimming** if estimated total would overflow
- **Prevents silent truncation** in LMStudio/local models

#### Phase B: Real-time Monitoring (During Streaming)
- **Read actual usage** from stream events as they arrive
- **Track cumulative tokens** as stream progresses
- **No manual counting** - leverage OpenAI API usage tracking
- **Abort if approaching limit** during generation

### 2. Context Limit Handling

#### Before Request (Input Estimation):
1. Estimate token count of: `conversationHistory + newMessage + systemPrompt`
2. If estimated input > `contextLimit * 0.8` (80% threshold for safety):
   - Trigger context summarization/trimming
   - Use summarizer agent to condense conversation history
   - Remove tool results that are no longer relevant
   - Keep recent messages and current task context
3. Re-estimate after trimming to ensure we're under limit
4. Only then send request to model

#### During Streaming (Real-time Monitoring):
1. Extract usage data from stream events (input tokens, output tokens, total tokens)
2. Monitor cumulative token usage in real-time
3. If `totalTokens > contextLimit * 0.9` (90% threshold):
   - Log warning about approaching limit
   - Send warning message in stream
4. If `totalTokens > contextLimit`:
   - Abort the stream immediately
   - Send error message explaining limit reached
   - Mark conversation for summarization before next request

#### After Request:
1. Store actual usage stats from the completed request
2. Update agent's context manager with final token counts
3. If we hit limit warnings, flag for proactive summarization next time

## Architecture Details

### Context Manager Placement
- **Each agent instance** gets its own `AgentContextManager`
- Passed to agent via the `context` parameter (accessible from tools)
- Multiple agents can share the same model without loading it twice (model stays in VRAM)

### Model Context Limits
- Fetched automatically from model provider's API during `getModels()`
- Stored as tuples: `[modelName, contextLimit]` instead of just `string[]`
- Providers can query model specs to get accurate context window sizes
- Falls back to provider defaults if model-specific limit unavailable

### Provider-Level Context Management
- Can be enabled/disabled per provider (mainly needed for LMStudio/Ollama)
- OpenAI/Claude handle context well, so can be disabled
- Local models may silently truncate, so should be enabled

### Token Counting Per Provider
- Each provider implements accurate token counting for their models
- LMStudio: Uses `gpt-tokenizer` (tiktoken) for GPT-4/Llama 3 models
- Ollama: Model-specific tokenizers (llama3, llama2, mistral, etc.)
- OpenAI: Uses `gpt-tokenizer` with model-specific encoding
- Context manager uses provider's token counter for accurate estimation

### Context Overflow Handling Strategy

**Problem**: Cannot modify agent conversation history mid-stream.

**Solution**: Detect overflow → Pause → Prune → Restart

1. **Detection (Tool + Context Manager)**
   - Tool calls `contextManager.checkBeforeToolResponse(toolResult)`
   - Context manager accurately estimates tokens using provider's tokenizer
   - Returns: `{ needsRestart: boolean, toolResult: string }`

2. **Pruning (Server + Pruning Agent)**
   - Server detects `needsRestart` signal from tool response
   - Server streams to client: "⚙️ Compacting conversation history..."
   - Server runs **separate pruning agent** to intelligently compact conversation
   - Pruning agent receives: conversation history + latest tool result
   - Pruning agent returns: compacted conversation summary + tool result

3. **Restart (Server)**
   - Server stops current agent stream
   - Server creates new run with same agent + pruned context
   - Server resumes streaming responses to client seamlessly
   - Process repeats if pruned context still overflows (loop)

**Flow Diagram**:
```
Tool executes → checkBeforeToolResponse() → Overflow detected
     ↓
Server receives needsRestart signal
     ↓
Stream to client: "⚙️ Compacting..."
     ↓
Run pruning agent on conversation + tool result
     ↓
Restart original agent with pruned context
     ↓
Resume streaming to client
     ↓
(Loop if still overflows)
```

## Implementation Plan

### Phase 0a: Add Token Counting Dependencies (5 min)

Install tokenizer libraries:

```bash
cd dev
pnpm add gpt-tokenizer
pnpm add llama3-tokenizer-js
pnpm add llama-tokenizer-js
pnpm add mistral-tokenizer-js
```

### Phase 0b: Add Token Counting to Model Providers (45 min)

**File: `src/models/providers/index.ts`**

Add abstract token counting methods:

```typescript
export abstract class ModelProvider {
  // ... existing properties

  abstract getModels(): Promise<ModelInfo[]>

  // NEW: Token counting methods
  abstract countTokens(text: string, modelName: string): number
  abstract countMessages(messages: any[], modelName: string): number
}
```

**File: `src/models/providers/lmstudio.ts`**

```typescript
import { encode, encodeChat } from 'gpt-tokenizer'
import type { ChatMessage } from 'gpt-tokenizer/GptEncoding'

export class LMStudio extends ModelProvider {
  // ... existing code

  countTokens(text: string, modelName: string): number {
    // LMStudio uses tiktoken-based tokenizer (GPT-4, Llama 3)
    return encode(text).length;
  }

  countMessages(messages: any[], modelName: string): number {
    const chatMessages: ChatMessage[] = messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: this.extractContent(m)
    }));

    return encodeChat(chatMessages, 'gpt-4').length;
  }

  private extractContent(msg: any): string {
    if (typeof msg.content === 'string') return msg.content;
    if (Array.isArray(msg.content)) {
      return msg.content.map(part => 'text' in part ? part.text : '').join('\n');
    }
    return '';
  }
}
```

**File: `src/models/providers/ollama.ts`** (create if doesn't exist)

```typescript
import Llama3Tokenizer from 'llama3-tokenizer-js'
import LlamaTokenizer from 'llama-tokenizer-js'
import MistralTokenizer from 'mistral-tokenizer-js'
import { encode } from 'gpt-tokenizer'

export class Ollama extends ModelProvider {
  private llama3Tokenizer = new Llama3Tokenizer()
  private llamaTokenizer = new LlamaTokenizer()
  private mistralTokenizer = new MistralTokenizer()

  // ... existing getModels code

  private detectModelFamily(modelName: string): 'llama3' | 'llama2' | 'mistral' | 'unknown' {
    const lower = modelName.toLowerCase();
    if (lower.includes('llama-3') || lower.includes('llama3')) return 'llama3';
    if (lower.includes('llama-2') || lower.includes('llama2')) return 'llama2';
    if (lower.includes('mistral') || lower.includes('mixtral')) return 'mistral';
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
        default:
          return encode(text).length; // Fallback to tiktoken
      }
    } catch (err) {
      console.warn(`[Tokenizer] Error, falling back:`, err);
      return encode(text).length;
    }
  }

  countMessages(messages: any[], modelName: string): number {
    const family = this.detectModelFamily(modelName);
    let totalTokens = 0;

    for (const msg of messages) {
      const content = this.extractContent(msg);
      totalTokens += this.countTokens(content, modelName);

      // Add per-message overhead
      totalTokens += family === 'mistral' ? 5 : 4;
    }

    return totalTokens + 3; // Reply priming tokens
  }

  private extractContent(msg: any): string {
    if (typeof msg.content === 'string') return msg.content;
    if (Array.isArray(msg.content)) {
      return msg.content.map(part => 'text' in part ? part.text : '').join('\n');
    }
    return '';
  }
}
```

**File: `src/models/providers/openai.ts`**

```typescript
import { encode, encodeChat } from 'gpt-tokenizer'
import type { ChatMessage } from 'gpt-tokenizer/GptEncoding'

export class OpenAI extends ModelProvider {
  // ... existing code

  countTokens(text: string, modelName: string): number {
    return encode(text).length;
  }

  countMessages(messages: any[], modelName: string): number {
    const chatMessages: ChatMessage[] = messages.map(m => ({
      role: m.role as 'system' | 'user' | 'assistant',
      content: this.extractContent(m)
    }));

    // Use gpt-4 encoding for all models (close enough)
    return encodeChat(chatMessages, 'gpt-4').length;
  }

  private extractContent(msg: any): string {
    if (typeof msg.content === 'string') return msg.content;
    if (Array.isArray(msg.content)) {
      return msg.content.map(part => 'text' in part ? part.text : '').join('\n');
    }
    return '';
  }
}
```

### Phase 0c: Update Model Provider to Fetch Context Limits (30 min)

**File: `src/models/providers/index.ts`**

Update the abstract base class to return model info including context limits:

```typescript
export interface ModelInfo {
  name: string;
  contextLimit?: number; // undefined = use provider default
}

export abstract class ModelProvider {
  id: ModelProviderID;
  baseURL: string;
  models: ModelInfo[]; // Changed from string[] to ModelInfo[]
  plugin: ObsidianAgentsServer
  instance?: ModelProviderInstance
  apiKeyRequired: boolean = false
  apiKey?: string

  constructor(plugin: ObsidianAgentsServer, providerSettings: ModelProviderSettings) {
    const provider = plugin.settings.modelProviders.find(p => p.id === providerSettings.id)
    if (provider) {
      this.id = provider.id
      this.baseURL = provider.baseURL
      this.plugin = plugin
      if (providerSettings.apiKey) {
        this.apiKey = providerSettings.apiKey
      }
      if (this.shouldCreateInstance()) {
        this.createInstance();
      }
      this.getModels().then(models => {
        this.models = models
      }).catch(e => {
        console.error('error fetching models: ', e)
      })
    }
  }

  // ... existing methods

  abstract getModels(): Promise<ModelInfo[]> // Changed return type

  // Helper method to get context limit for a specific model
  getModelContextLimit(modelName: string): number | undefined {
    const modelInfo = this.models.find(m => m.name === modelName);
    return modelInfo?.contextLimit;
  }
}
```

**File: `src/models/providers/lmstudio.ts`**

Update to fetch context limits from model metadata:

```typescript
export class LMStudio extends ModelProvider {
  // ... existing code

  async getModels(): Promise<ModelInfo[]> {
    const res = await requestUrl(`${this.baseURL}/models`)
    if (res.status === 200) {
      const modelsData = res.json.data as GetModelsResponse;

      return modelsData.map(m => {
        // LMStudio sometimes includes context_length in metadata
        // Otherwise fallback to default
        const contextLimit = m.context_length ||
                            this.parseContextFromModelName(m.id) ||
                            undefined;

        return {
          name: m.id,
          contextLimit
        };
      });
    }
    return []
  }

  // Helper to parse context from model name (e.g., "llama-3-8k", "gpt-4-128k")
  private parseContextFromModelName(modelName: string): number | undefined {
    const match = modelName.match(/(\d+)k/i);
    if (match) {
      return parseInt(match[1]) * 1024;
    }
    return undefined;
  }
}
```

**File: `src/models/providers/ollama.ts`** (if not exists yet)

Ollama can fetch model details including context window:

```typescript
export class Ollama extends ModelProvider {
  // ... existing code

  async getModels(): Promise<ModelInfo[]> {
    const res = await requestUrl(`${this.baseURL}/api/tags`)
    if (res.status === 200) {
      const modelsData = res.json.models;

      // Fetch detailed info for each model
      const modelInfoPromises = modelsData.map(async (m: any) => {
        try {
          // Get model details to find context length
          const detailRes = await requestUrl({
            url: `${this.baseURL}/api/show`,
            method: 'POST',
            body: JSON.stringify({ name: m.name }),
            headers: { 'Content-Type': 'application/json' }
          });

          if (detailRes.status === 200) {
            const details = detailRes.json;
            // Ollama includes num_ctx in modelfile parameters
            const contextLimit = details.parameters?.num_ctx ||
                                details.model_info?.['context_length'] ||
                                undefined;

            return {
              name: m.name,
              contextLimit
            };
          }
        } catch (err) {
          console.warn(`Failed to fetch details for ${m.name}:`, err);
        }

        return {
          name: m.name,
          contextLimit: undefined // Will use provider default
        };
      });

      return Promise.all(modelInfoPromises);
    }
    return []
  }
}
```

**File: `src/models/providers/openai.ts`**

OpenAI has known context limits per model:

```typescript
export class OpenAI extends ModelProvider {
  // ... existing code

  private KNOWN_LIMITS: Record<string, number> = {
    'gpt-4-turbo': 128000,
    'gpt-4-turbo-preview': 128000,
    'gpt-4': 8192,
    'gpt-4-32k': 32768,
    'gpt-3.5-turbo': 16384,
    'gpt-3.5-turbo-16k': 16384,
    'o1-preview': 128000,
    'o1-mini': 128000,
  };

  async getModels(): Promise<ModelInfo[]> {
    const res = await requestUrl({
      url: `${this.baseURL}/models`,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    if (res.status === 200) {
      const modelsData = res.json.data as GetModelsResponse;

      return modelsData.map(m => ({
        name: m.id,
        contextLimit: this.KNOWN_LIMITS[m.id] || undefined
      }));
    }
    return []
  }
}
```

### Phase 1: Context Manager Infrastructure (40 min)

**File: `src/lib/context-manager.ts`** (New file)
```typescript
import { ModelProvider } from '~/models/providers';

export interface UsageData {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ContextManagementOptions {
  enabled: boolean; // Provider-level flag
  contextLimit: number;
  warningThreshold: number; // Default 0.9 (90%)
  inputThreshold: number; // Default 0.8 (80%)
}

export interface ToolResponseCheck {
  needsRestart: boolean;
  toolResult: string;
}

export class AgentContextManager {
  private usage: UsageData = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  private options: ContextManagementOptions;
  private modelProvider: ModelProvider;
  private modelName: string;
  private conversationHistory: any[] = [];

  constructor(
    options: ContextManagementOptions,
    modelProvider: ModelProvider,
    modelName: string
  ) {
    this.options = options;
    this.modelProvider = modelProvider;
    this.modelName = modelName;
  }

  isEnabled(): boolean {
    return this.options.enabled;
  }

  // Update conversation history as messages are added
  updateConversationHistory(messages: any[]): void {
    this.conversationHistory = messages;
  }

  getConversationHistory(): any[] {
    return this.conversationHistory;
  }

  // Phase B: Real-time monitoring during streaming
  updateUsage(usage: Partial<UsageData>): void {
    if (usage.inputTokens !== undefined) {
      this.usage.inputTokens = usage.inputTokens;
    }
    if (usage.outputTokens !== undefined) {
      this.usage.outputTokens = usage.outputTokens;
    }
    if (usage.totalTokens !== undefined) {
      this.usage.totalTokens = usage.totalTokens;
    } else {
      this.usage.totalTokens = this.usage.inputTokens + this.usage.outputTokens;
    }
  }

  getCurrentTotal(): number {
    return this.usage.totalTokens;
  }

  getUsagePercentage(): number {
    return (this.usage.totalTokens / this.options.contextLimit) * 100;
  }

  isApproachingLimit(): boolean {
    if (!this.isEnabled()) return false;
    return this.usage.totalTokens > this.options.contextLimit * this.options.warningThreshold;
  }

  isOverLimit(): boolean {
    if (!this.isEnabled()) return false;
    return this.usage.totalTokens > this.options.contextLimit;
  }

  // Phase C: Tool-level context checking
  // Called by tools before returning results
  // Returns signal to restart + tool result
  checkBeforeToolResponse(toolResult: string): ToolResponseCheck {
    if (!this.isEnabled()) {
      return { needsRestart: false, toolResult };
    }

    // Use provider's accurate token counting
    const toolResultTokens = this.modelProvider.countTokens(toolResult, this.modelName);

    // Project total if we add this tool result
    const projectedTotal = this.usage.totalTokens + toolResultTokens;

    // If adding this result would overflow, signal restart needed
    if (projectedTotal > this.options.contextLimit) {
      console.warn(
        `[Context] Tool result would overflow context window:\n` +
        `  Current: ${this.usage.totalTokens} tokens\n` +
        `  Tool result: ${toolResultTokens} tokens\n` +
        `  Projected: ${projectedTotal} tokens\n` +
        `  Limit: ${this.options.contextLimit} tokens\n` +
        `  → Signaling restart for context compaction`
      );

      return {
        needsRestart: true,
        toolResult
      };
    }

    return { needsRestart: false, toolResult };
  }

  getUsageStats() {
    return {
      ...this.usage,
      contextLimit: this.options.contextLimit,
      percentageUsed: this.getUsagePercentage(),
      needsSummarization: this.needsSummarization,
      enabled: this.options.enabled,
      conversationLength: this.conversationHistory.length,
    };
  }

  reset(): void {
    this.usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
    this.needsSummarization = false;
    this.conversationHistory = [];
  }
}
```

### Phase 2: Update convertStreamToChunks (25 min)

**File: `src/lib/utils.ts`**

Modify `convertStreamToChunks` to:
1. Accept `StreamingContextManager` instance
2. Extract usage data from stream events
3. Update context manager with usage info
4. Check limits and abort if needed
5. Emit warning chunks when approaching limit

```typescript
export async function* convertStreamToChunks(
  stream: StreamedRunResult<any, any>,
  model: string,
  contextManager?: StreamingContextManager
): AsyncGenerator<ChatCompletionChunk> {
  const id = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);

  let warningEmitted = false;

  for await (const event of stream) {
    // Extract usage data from stream events (added by OpenAI agents SDK)
    if (contextManager && event.usage) {
      contextManager.updateUsage({
        inputTokens: event.usage.input_tokens,
        outputTokens: event.usage.output_tokens,
        totalTokens: event.usage.total_tokens,
      });

      // Check if over limit - abort immediately
      if (contextManager.isOverLimit()) {
        const stats = contextManager.getUsageStats();
        console.error('[Context] Limit exceeded:', stats);

        yield {
          id,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [{
            index: 0,
            delta: {
              content: `\n\n⚠️ [Context limit exceeded: ${stats.totalTokens}/${stats.contextLimit} tokens (${stats.percentageUsed.toFixed(1)}%)]\n`,
            },
            finish_reason: 'length',
            logprobs: null,
          }],
        };
        return; // Stop streaming
      }

      // Warn if approaching limit (once)
      if (!warningEmitted && contextManager.isApproachingLimit(0.9)) {
        const stats = contextManager.getUsageStats();
        console.warn('[Context] Approaching limit:', stats);
        warningEmitted = true;

        yield {
          id,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [{
            index: 0,
            delta: {
              content: `\n\n⚠️ [Warning: Approaching context limit - ${stats.totalTokens}/${stats.contextLimit} tokens (${stats.percentageUsed.toFixed(1)}%)]\n\n`,
            },
            finish_reason: null,
            logprobs: null,
          }],
        };
      }
    }

    // Handle text deltas
    if (event.type === 'raw_model_stream_event' && event.data?.type === 'output_text_delta') {
      const delta = event.data.delta || '';

      // Emit the actual content delta
      yield {
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{
          index: 0,
          delta: { content: delta },
          finish_reason: null,
          logprobs: null,
        }],
      };
    }

    // ... rest of tool call handling ...
  }

  // Log final usage
  if (contextManager) {
    const finalStats = contextManager.getUsageStats();
    console.log('[Context] Stream complete:', finalStats);
  }

  // Final chunk
  yield {
    id,
    object: 'chat.completion.chunk',
    created,
    model,
    choices: [{
      index: 0,
      delta: {},
      finish_reason: 'stop',
      logprobs: null,
    }],
  };
}
```

### Phase 3: Tool Usage Example (15 min)

**Example: Tools using context manager to detect overflow**

```typescript
// Example: A tool that reads large files
const readFileTool = {
  name: "read_file",
  description: "Read a file from vault",
  parameters: z.object({
    path: z.string(),
  }),
  execute: async ({ path }, context) => {
    const fileContent = await readFile(path); // Could be very large

    // Access context manager from agent context
    const contextManager = context.contextManager as AgentContextManager;

    if (!contextManager) {
      return fileContent; // No context management
    }

    // Context manager checks if result would overflow
    // Returns: { needsRestart: boolean, toolResult: string }
    const check = contextManager.checkBeforeToolResponse(fileContent);

    // If needsRestart, the server will handle pruning and restart
    // Tool just returns the result - server intercepts the restart signal
    return check.toolResult;
  }
};

// Example: Search tool
const searchTool = {
  name: "omni_search",
  description: "Search vault for notes",
  parameters: z.object({
    query: z.string(),
  }),
  execute: async ({ query }, context) => {
    const results = await searchVault(query);
    const resultsText = JSON.stringify(results, null, 2);

    const contextManager = context.contextManager as AgentContextManager;

    if (!contextManager) {
      return resultsText;
    }

    const check = contextManager.checkBeforeToolResponse(resultsText);
    return check.toolResult;
  }
};
```

**Note**: Tools don't need to know about the restart logic. They just check and return. The server detects the `needsRestart` signal and handles the pruning/restart orchestration.

### Phase 4: Create Pruning Agent (20 min)

**File: `src/agents/pruning-agent.ts`** (New file)

```typescript
import { Agent } from '@openai/agents';

export async function createPruningAgent(
  modelProvider: any,
  model: string
): Promise<Agent> {
  return new Agent({
    name: 'Context Pruning Agent',
    model: modelProvider.instance(model),
    instructions: `You are a context compression agent. Your job is to intelligently compact conversation history while preserving critical information.

**Your task:**
1. Analyze the conversation history provided
2. Identify and preserve:
   - The system message/instructions
   - The current task or question being worked on
   - Recent tool calls and their key results
   - Important context needed to continue the conversation
3. Remove or summarize:
   - Old tool results no longer relevant
   - Redundant messages
   - Completed tasks that don't affect current work

**Output format:**
Return a JSON object with this structure:
{
  "prunedConversation": [
    // Array of pruned messages in original format
  ],
  "summary": "Brief summary of what was removed/compacted"
}

Be aggressive in compaction but preserve everything needed to continue the current task effectively.`,
  });
}
```

### Phase 5: Server Restart Loop Handling (60 min)

**File: `src/index.ts`**

This is the core orchestration logic for detecting overflow, pruning, and restarting:

```typescript
import { AgentContextManager } from '~/lib/context-manager';
import { createPruningAgent } from '~/agents/pruning-agent';

// Helper to detect if context manager signaled a restart
function needsContextRestart(contextManager: AgentContextManager): boolean {
  // Check if last tool response check signaled restart
  // (This would be stored temporarily in context manager)
  return contextManager.shouldRestartForContext();
}

// Main restart loop handler
async function runAgentWithContextManagement(
  agent: Agent,
  messages: any[],
  contextManager: AgentContextManager,
  maxRestarts: number = 3
): Promise<any> {
  let attempt = 0;
  let currentMessages = messages;

  while (attempt < maxRestarts) {
    attempt++;

    try {
      // Run the agent
      const result = await runner.run(agent, convertMessagesToAgentInput(currentMessages));

      // Check if any tool signaled a restart
      if (contextManager.needsRestart()) {
        console.log(`[Context] Restart signal detected (attempt ${attempt}/${maxRestarts})`);

        // Get conversation history + last tool result
        const conversation = contextManager.getConversationHistory();
        const toolResult = contextManager.getLastToolResult();

        // Run pruning agent to compact conversation
        console.log('[Context] Running pruning agent to compact conversation...');
        const pruningAgent = await createPruningAgent(
          modelProvider,
          agentSettings.model
        );

        const pruningResult = await runner.run(pruningAgent, [{
          role: 'user',
          content: JSON.stringify({
            conversation,
            latestToolResult: toolResult,
            contextLimit: contextManager.options.contextLimit
          })
        }]);

        // Extract pruned conversation from pruning agent response
        const prunedData = JSON.parse(pruningResult.output[0].content);
        currentMessages = prunedData.prunedConversation;

        console.log(`[Context] Conversation compacted: ${prunedData.summary}`);
        console.log(`[Context] Restarting agent with pruned context...`);

        // Update context manager with new conversation
        contextManager.updateConversationHistory(currentMessages);
        contextManager.resetRestartFlag();

        // Loop continues with pruned messages
        continue;
      }

      // No restart needed, return result
      return result;

    } catch (error) {
      console.error(`[Context] Error during agent run (attempt ${attempt}):`, error);
      throw error;
    }
  }

  throw new Error(`[Context] Max restart attempts (${maxRestarts}) exceeded`);
}

// Update chat completions endpoint
app.post("/v1/chat/completions", async (c) => {
  try {
    const body = await c.req.json() as CreateChatCompletionBody
    const { model, messages, stream = false } = body

    const agent = Object.values(this.agents).find(a => a.instance.name === model)
    if (!agent) {
      return c.json({ error: { message: `Model '${model}' not found`, type: "invalid_request_error" } }, 404)
    }

    // Get context manager from agent
    const contextManager = agent.contextManager;

    // Update conversation history in context manager
    if (contextManager) {
      contextManager.updateConversationHistory(messages);
    }

    if (stream) {
      // TODO: Implement streaming with restart support
      // This is complex - need to detect restart mid-stream
      // For now, fall back to non-streaming if restart detected

      console.log(`[Context] Starting stream for agent: ${agent.settings.name}`);

      const result = await this.runner.run(agent.instance, convertMessagesToAgentInput(messages), { stream: true });

      return streamSSE(c, async (stream) => {
        try {
          for await (const chunk of convertStreamToChunks(result, model, contextManager)) {
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

    // Non-streaming: Use restart loop
    const result = await runAgentWithContextManagement(
      agent.instance,
      messages,
      contextManager
    );

    const response = convertRunResultToCompletion(result, model);
    console.log('[Context] Non-streaming complete:', response.usage);

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

### Phase 6: Context Manager Restart State Tracking (15 min)

Update `AgentContextManager` to track restart state:

```typescript
export class AgentContextManager {
  // ... existing properties
  private restartRequested: boolean = false;
  private lastToolResult?: string;

  // Called when tool signals restart
  markRestartNeeded(toolResult: string): void {
    this.restartRequested = true;
    this.lastToolResult = toolResult;
  }

  needsRestart(): boolean {
    return this.restartRequested;
  }

  getLastToolResult(): string | undefined {
    return this.lastToolResult;
  }

  resetRestartFlag(): void {
    this.restartRequested = false;
    this.lastToolResult = undefined;
  }

  // Update checkBeforeToolResponse to mark restart
  checkBeforeToolResponse(toolResult: string): ToolResponseCheck {
    if (!this.isEnabled()) {
      return { needsRestart: false, toolResult };
    }

    const toolResultTokens = this.modelProvider.countTokens(toolResult, this.modelName);
    const projectedTotal = this.usage.totalTokens + toolResultTokens;

    if (projectedTotal > this.options.contextLimit) {
      console.warn(`[Context] Tool result would overflow - marking for restart`);

      this.markRestartNeeded(toolResult); // NEW: Store restart state

      return {
        needsRestart: true,
        toolResult
      };
    }

    return { needsRestart: false, toolResult };
  }
}
```

### Phase 7: Integrate into Chat Completion Endpoint (30 min)

**File: `src/index.ts`**

Update the `/v1/chat/completions` endpoint to create and update context manager:

```typescript
app.post("/v1/chat/completions", async (c) => {
  try {
    const body = await c.req.json() as CreateChatCompletionBody
    const { model, messages, stream = false } = body

    const agent = Object.values(this.agents).find(a => a.instance.name === model)
    if (!agent) {
      return c.json({ error: { message: `Model '${model}' not found`, type: "invalid_request_error" } }, 404)
    }

    // Get context manager from agent (created during agent initialization)
    const contextManager = agent.contextManager;

    // Update conversation history in context manager
    if (contextManager) {
      contextManager.updateConversationHistory(messages);
    }

    const agentMessages = convertMessagesToAgentInput(messages);

    if (stream) {
      console.log(`[Context] Starting stream for agent: ${agent.settings.name}`);

      const result = await this.runner.run(agent.instance, agentMessages, { stream: true });

      return streamSSE(c, async (stream) => {
        try {
          for await (const chunk of convertStreamToChunks(result, model, contextManager)) {
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

    // Non-streaming: Usage data comes from the result
    const result = await this.runner.run(agent.instance, agentMessages);
    const response = convertRunResultToCompletion(result, model);

    // Usage data is already included in the response from OpenAI agents SDK
    console.log('[Context] Non-streaming complete:', response.usage);

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

### Phase 4: Add Context Limit Configuration (20 min)

**File: `src/models/providers/constants.ts`**

Add context limits to provider constants:

```typescript
export const MODEL_PROVIDERS = {
  openai: {
    id: "openai",
    label: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    apiKeyRequired: true,
    defaultContextLimit: 128000 // gpt-4-turbo default
  },
  lmstudio: {
    id: "lmstudio",
    label: "LMStudio",
    baseURL: "http://localhost:1234/v1",
    apiKeyRequired: false,
    defaultContextLimit: 8192 // Conservative default
  },
  ollama: {
    id: "ollama",
    label: "Ollama",
    baseURL: "http://localhost:11434",
    apiKeyRequired: false,
    defaultContextLimit: 8192 // Conservative default
  }
} as const
```

**File: `src/agents/types.ts`**

Add context limit to agent settings:

```typescript
export interface AgentSettings {
  id: string;
  name: string;
  instructions: string;
  model: string;
  modelProvider: ModelProviderID;
  contextLimit?: number; // Optional override per agent
  // ... rest of fields
}
```

### Phase 5: Settings UI for Context Limits (30 min)

**File: `src/agents/settings/index.tsx`**

Add context limit field to agent settings form:

```tsx
<form.AppField name={`agents[${i}].contextLimit`}>
  {(subField) => (
    <subField.TextField
      label="Context Limit (tokens)"
      description={`Maximum tokens for this agent. Default: ${
        MODEL_PROVIDERS[agent.modelProvider]?.defaultContextLimit || 8192
      }`}
      inputProps={{
        type: "number",
        placeholder: `${MODEL_PROVIDERS[agent.modelProvider]?.defaultContextLimit || 8192}`
      }}
    />
  )}
</form.AppField>
```

## Testing Plan

### 1. Unit Tests (Manual)
- Test token counting with various message lengths
- Verify context manager correctly tracks cumulative tokens
- Test limit detection at 90%, 100%, and over 100%

### 2. Integration Tests
- **Small context test**: Set limit to 1000 tokens, send long message, verify abort
- **Warning test**: Set limit to high value, verify warning at 90%
- **Multiple requests**: Verify token counting resets between requests
- **Tool calls**: Verify tool call outputs are counted

### 3. Real-world Testing
- Test with actual OpenAI models
- Test with LMStudio models
- Verify logs show accurate token counts
- Verify stream aborts gracefully when limit hit

## Migration Path

1. ✅ Phase 1: Create StreamingContextManager class (simplified, no manual counting)
2. ✅ Phase 2: Update convertStreamToChunks to extract usage from stream events
3. ✅ Phase 3: Integrate into chat completion endpoint
4. ✅ Phase 4: Add configuration for context limits
5. ✅ Phase 5: Add UI for context limit settings
6. 🧪 Testing: Verify all functionality works

## Benefits of This Approach

1. **Native usage tracking**: Leverage OpenAI agents SDK's built-in usage data
2. **Real-time monitoring**: Track token usage as stream progresses
3. **Immediate abort**: Stop generation as soon as limit hit, saving costs
4. **No manual counting**: Simpler implementation, no tokenizer dependency
5. **Accurate**: Usage data comes directly from the model provider
6. **Configurable**: Per-agent context limits
7. **Visible warnings**: User sees warnings before hard limit

## Future Enhancements

1. **Smart trimming**: Automatically remove old messages when approaching limit
2. **Per-model limits**: Fetch actual model context limits from provider specs
3. **Usage analytics**: Track token usage over time per agent
4. **Cost estimation**: Show estimated API costs based on usage
5. **History management**: Summarize old messages to save context
6. **Fallback counting**: For providers that don't support usage tracking during streaming

## Notes

- Usage tracking during streaming is now supported by OpenAI agents SDK
- No need for manual token counting or tokenizer libraries
- The 90% warning threshold is configurable per use case
- Context management is simpler without manual counting logic
- Usage data format: `{ input_tokens, output_tokens, total_tokens }`
