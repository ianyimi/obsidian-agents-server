# Implementation Strategy - Three-Phase Autocompaction

## Overview

The autocompaction system uses a **three-phase defense strategy** to prevent LMStudio's default "cut middle" context truncation behavior:

1. **Pre-Request (80%):** Proactive compaction before sending request
2. **Tool Response:** Defensive compaction when tool results are large
3. **Real-Time (90%):** Reactive compaction during streaming generation

## Phase 1: Pre-Request Compaction (80% Threshold)

### Trigger Point
**Location:** `/v1/chat/completions` endpoint, BEFORE calling `agent.run()`

### Flow
```
1. Receive chat completion request with messages
2. Check if agent has context manager (LMStudio only)
3. Estimate total input tokens:
   - System prompt
   - Conversation history
   - New user message
   - Buffer for expected output (~20% of remaining context)
4. If estimated > 80% of context limit:
   └─> Run pruning agent synchronously
   └─> Replace messages with pruned version
   └─> Log: "[Context] Pre-request compaction: X → Y tokens"
5. Send (possibly pruned) messages to agent
```

### Implementation Pseudocode
```typescript
app.post("/v1/chat/completions", async (c) => {
  const { model, messages, stream } = await c.req.json();
  const agent = findAgent(model);
  const contextManager = agent.contextManager;

  // PRE-REQUEST COMPACTION
  if (contextManager?.isEnabled()) {
    contextManager.updateConversationHistory(messages);

    const estimatedTokens = contextManager.estimateInputTokens(messages);
    const threshold = contextManager.options.contextLimit * 0.8;

    if (estimatedTokens > threshold) {
      console.log(`[Context] Pre-request compaction needed: ${estimatedTokens}/${contextManager.options.contextLimit} (${Math.round(estimatedTokens/contextManager.options.contextLimit*100)}%)`);

      // Run pruning agent
      const prunedMessages = await runPruningAgent(
        messages,
        contextManager,
        agent.settings.pruningAgent
      );

      // Update messages
      messages = prunedMessages;
      contextManager.updateConversationHistory(prunedMessages);

      const newTokens = contextManager.estimateInputTokens(prunedMessages);
      console.log(`[Context] Compacted: ${estimatedTokens} → ${newTokens} tokens`);
    }
  }

  // Now run agent with (possibly compacted) messages
  const result = await runner.run(agent.instance, convertToAgentInput(messages), { stream });
  // ...
});
```

### Key Methods Needed

**In AgentContextManager:**
```typescript
estimateInputTokens(messages: any[]): number {
  // Use provider's countMessages to estimate total
  const totalTokens = this.modelProvider.countMessages(messages, this.modelName);

  // Add buffer for output (20% of remaining context)
  const remainingContext = this.options.contextLimit - totalTokens;
  const outputBuffer = Math.max(remainingContext * 0.2, 1000);

  return totalTokens + outputBuffer;
}
```

---

## Phase 2: Tool Response Compaction (Dynamic Threshold)

### Trigger Point
**Location:** Inside tool execution, BEFORE returning result to agent

### Flow
```
1. Tool executes and gets result (e.g., large file content)
2. Tool calls contextManager.checkBeforeToolResponse(result)
3. Context manager estimates:
   - Current conversation tokens
   - Tool result tokens
   - Projected total
4. If projected > context limit:
   └─> Mark restart needed
   └─> Store tool result for later
   └─> Signal to server via context manager state
5. Server detects restart signal after tool completes
6. Server runs pruning agent:
   └─> Prune conversation history
   └─> Keep tool result
7. Server restarts agent with pruned context + tool result
8. Continue execution
```

### Implementation Pseudocode

**In Tool:**
```typescript
const readFileTool = {
  name: "read_file",
  execute: async ({ path }, context) => {
    const fileContent = await readFile(path);

    // Check if result fits in context
    const contextManager = context.contextManager as AgentContextManager;
    if (contextManager?.isEnabled()) {
      const check = contextManager.checkBeforeToolResponse(fileContent);

      if (check.needsRestart) {
        console.log('[Context] Tool result too large, signaling restart');
        contextManager.markRestartNeeded(fileContent);
      }

      return check.toolResult;
    }

    return fileContent;
  }
};
```

**In AgentContextManager:**
```typescript
checkBeforeToolResponse(toolResult: string): ToolResponseCheck {
  if (!this.isEnabled()) {
    return { needsRestart: false, toolResult };
  }

  // Calculate tokens
  const currentTokens = this.getCurrentTotal();
  const toolResultTokens = this.modelProvider.countTokens(toolResult, this.modelName);
  const projectedTotal = currentTokens + toolResultTokens;

  // Check if would overflow
  if (projectedTotal > this.options.contextLimit) {
    console.warn(
      `[Context] Tool result would overflow:\n` +
      `  Current: ${currentTokens} tokens\n` +
      `  Tool result: ${toolResultTokens} tokens\n` +
      `  Projected: ${projectedTotal} tokens\n` +
      `  Limit: ${this.options.contextLimit} tokens`
    );

    return { needsRestart: true, toolResult };
  }

  return { needsRestart: false, toolResult };
}

markRestartNeeded(toolResult: string): void {
  this.restartRequested = true;
  this.lastToolResult = toolResult;
}

needsRestart(): boolean {
  return this.restartRequested;
}
```

**In Server (after tool execution):**
```typescript
// After agent run completes or during streaming
if (contextManager.needsRestart()) {
  console.log('[Context] Restart requested due to tool result overflow');

  // Get conversation + tool result
  const conversation = contextManager.getConversationHistory();
  const toolResult = contextManager.getLastToolResult();

  // Run pruning agent
  const prunedMessages = await runPruningAgent(
    conversation,
    contextManager,
    agent.settings.pruningAgent,
    { keepToolResult: toolResult }
  );

  // Reset restart flag
  contextManager.resetRestartFlag();

  // Restart agent with pruned context
  return runAgentWithContextManagement(agent, prunedMessages, contextManager);
}
```

---

## Phase 3: Real-Time Compaction (90% Threshold)

### Trigger Point
**Location:** Inside `convertStreamToChunks`, during streaming

### Flow
```
1. Stream events arriving from agent
2. Extract usage data from each event
3. Update context manager with current token usage
4. Check threshold:
   - If > 90%:
     └─> Pause stream
     └─> Emit "⚙️ Compacting..." chunk to client
     └─> Run pruning agent on conversation
     └─> Restart agent with pruned context
     └─> Resume streaming
   - If > 100% (emergency):
     └─> Emit error chunk
     └─> Abort stream
5. Continue streaming normally if under threshold
```

### Implementation Pseudocode

**In convertStreamToChunks:**
```typescript
export async function* convertStreamToChunks(
  stream: StreamedRunResult,
  model: string,
  contextManager?: AgentContextManager,
  onCompactionNeeded?: (conversationHistory: any[]) => Promise<any[]>
): AsyncGenerator<ChatCompletionChunk> {
  const id = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);

  for await (const event of stream) {
    // Extract usage from stream
    if (contextManager && event.usage) {
      contextManager.updateUsage({
        inputTokens: event.usage.input_tokens,
        outputTokens: event.usage.output_tokens,
        totalTokens: event.usage.total_tokens,
      });

      const percentage = contextManager.getUsagePercentage();

      // CRITICAL: 90% triggers automatic compaction
      if (percentage >= 90 && percentage < 100) {
        console.warn(`[Context] 90% threshold reached (${Math.round(percentage)}%), triggering compaction`);

        // Emit compaction message to user
        yield createContentChunk(id, created, model, '\n\n⚙️ Compacting conversation history...\n\n');

        // Signal compaction needed
        if (onCompactionNeeded) {
          const conversation = contextManager.getConversationHistory();
          const prunedMessages = await onCompactionNeeded(conversation);

          // Update context manager
          contextManager.updateConversationHistory(prunedMessages);
          contextManager.reset(); // Reset token counts

          console.log('[Context] Conversation compacted, restarting stream');
          yield createContentChunk(id, created, model, '✅ Context compacted, continuing...\n\n');

          // TODO: How to restart stream here?
          // This is the complex part - need to abort current stream and restart agent
          return; // For now, abort and restart externally
        }
      }

      // EMERGENCY: 100% abort
      if (percentage >= 100) {
        console.error(`[Context] Context limit exceeded (${Math.round(percentage)}%), aborting`);
        yield createContentChunk(
          id, created, model,
          `\n\n⚠️ Context limit exceeded (${contextManager.getCurrentTotal()}/${contextManager.options.contextLimit} tokens). Aborting.\n`
        );
        return;
      }
    }

    // Normal content streaming
    if (event.type === 'raw_model_stream_event' && event.data?.type === 'output_text_delta') {
      yield createContentChunk(id, created, model, event.data.delta || '');
    }

    // ... handle other event types
  }

  // Final chunk
  yield createFinalChunk(id, created, model);
}
```

### Challenge: Mid-Stream Restart

The complex part is **restarting the agent mid-stream** when 90% is reached. Options:

**Option A: Abort and Restart Externally**
```typescript
// In chat completions endpoint
if (stream) {
  let compactionNeeded = false;

  const streamWithCompaction = async function* () {
    for await (const chunk of convertStreamToChunks(result, model, contextManager)) {
      yield chunk;

      // Check if compaction was triggered
      if (contextManager.getUsagePercentage() >= 90) {
        compactionNeeded = true;
        break; // Stop current stream
      }
    }
  };

  // Stream to client
  await streamToClient(streamWithCompaction());

  // If compaction needed, run it and restart
  if (compactionNeeded) {
    const prunedMessages = await runPruningAgent(/*...*/);
    // Recursively call same endpoint with pruned messages
    return handleChatCompletion(c, { model, messages: prunedMessages, stream });
  }
}
```

**Option B: Nested Stream Generator**
```typescript
async function* streamWithAutoCompaction(
  agent: Agent,
  messages: any[],
  contextManager: AgentContextManager,
  maxRestarts: number = 3
): AsyncGenerator<ChatCompletionChunk> {
  let attempt = 0;
  let currentMessages = messages;

  while (attempt < maxRestarts) {
    attempt++;

    const result = await runner.run(agent, convertToAgentInput(currentMessages), { stream: true });

    for await (const chunk of convertStreamToChunks(result, agent.name, contextManager)) {
      yield chunk;

      // Check if compaction triggered
      if (contextManager.getUsagePercentage() >= 90) {
        console.log(`[Context] Compaction triggered (attempt ${attempt}/${maxRestarts})`);

        // Run pruning
        const prunedMessages = await runPruningAgent(currentMessages, contextManager, agent.settings.pruningAgent);
        currentMessages = prunedMessages;
        contextManager.reset();

        // Break to restart loop
        break;
      }
    }

    // If we didn't need compaction, exit loop
    if (contextManager.getUsagePercentage() < 90) {
      break;
    }
  }

  if (attempt >= maxRestarts) {
    yield createContentChunk(/*...*/, '\n\n⚠️ Max compaction attempts reached\n');
  }
}
```

**Recommendation:** Option B (Nested stream generator) is cleaner and keeps restart logic contained.

---

## Pruning Agent Implementation

### Pruning Agent Prompt
```typescript
export async function createPruningAgent(
  modelProvider: ModelProvider,
  model: string
): Promise<Agent> {
  return new Agent({
    name: 'Context Compaction Agent',
    model: modelProvider.instance(model),
    instructions: `You are a context compression specialist. Your job is to intelligently compact conversation history while preserving all critical information needed to continue the task.

**Preservation Priorities (MUST KEEP):**
1. System message and agent instructions
2. Current task description and goals
3. Most recent 3-5 messages (current context)
4. Active tool calls and their results from recent messages
5. Key decisions, findings, or data from earlier in conversation

**Compaction Strategies (CAN REMOVE/SUMMARIZE):**
1. Old tool results no longer relevant to current task
2. Completed sub-tasks that don't affect current work
3. Redundant or repetitive messages
4. Long tool outputs - summarize key points instead of full text
5. Back-and-forth clarifications that reached conclusion

**Output Format:**
Return ONLY a valid JSON object (no markdown, no explanation):
{
  "prunedConversation": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." },
    ...
  ],
  "summary": "Brief summary of what was removed/compacted",
  "originalTokens": <estimated original count>,
  "prunedTokens": <estimated pruned count>
}

**Critical Rules:**
- NEVER lose information about the current task
- NEVER remove the most recent messages
- Be aggressive with old tool results
- Summarize lengthy content rather than removing entirely
- Aim for 40-60% reduction in token count`,
  });
}
```

### Pruning Agent Invocation
```typescript
async function runPruningAgent(
  messages: any[],
  contextManager: AgentContextManager,
  pruningAgentSettings: AgentSettings,
  options?: { keepToolResult?: string }
): Promise<any[]> {
  try {
    console.log('[Pruning] Starting conversation compaction');

    // Get pruning agent (could be same model or different)
    const pruningAgent = await createPruningAgent(
      contextManager.modelProvider,
      pruningAgentSettings.model
    );

    // Prepare input for pruning agent
    const input = {
      conversation: messages,
      currentTokens: contextManager.getCurrentTotal(),
      contextLimit: contextManager.options.contextLimit,
      keepToolResult: options?.keepToolResult,
    };

    // Run pruning agent
    const result = await runner.run(pruningAgent, [{
      role: 'user',
      content: JSON.stringify(input, null, 2)
    }]);

    // Parse result
    const output = JSON.parse(result.output[0].content);

    console.log(`[Pruning] Complete: ${output.originalTokens} → ${output.prunedTokens} tokens`);
    console.log(`[Pruning] Summary: ${output.summary}`);

    return output.prunedConversation;

  } catch (error) {
    console.error('[Pruning] Failed:', error);

    // Fallback: Simple truncation (keep system + last N messages)
    console.warn('[Pruning] Using fallback truncation');
    return [
      messages[0], // System message
      ...messages.slice(-5) // Last 5 messages
    ];
  }
}
```

---

## Settings UI for Pruning Agent

### Location
**LMStudio Provider Settings** (global setting)

### UI Component
```tsx
<form.AppField name="pruningAgent">
  {(field) => (
    <>
      <field.Label>Context Pruning Agent</field.Label>
      <field.Description>
        Agent used to compact conversation history when approaching context limit.
        Choose a fast, capable model.
      </field.Description>

      <field.SelectField
        label="Pruning Agent"
        options={[
          { value: '__same__', label: 'Same as current agent (default)' },
          ...availableAgents.map(a => ({
            value: a.id,
            label: `${a.name} (${a.model})`
          }))
        ]}
      />
    </>
  )}
</form.AppField>
```

### Settings Structure
```typescript
interface LMStudioProviderSettings extends ModelProviderSettings {
  pruningAgentId?: string; // Agent ID or '__same__'
}
```

---

## Summary: Three-Phase Defense

| Phase | Threshold | Trigger Point | Action | Purpose |
|-------|-----------|---------------|--------|---------|
| **Pre-Request** | 80% | Before `agent.run()` | Compact then send | Prevent oversized requests |
| **Tool Response** | Dynamic | Inside tool execution | Compact then restart | Prevent large tool results from overflowing |
| **Real-Time** | 90% | During streaming | Pause, compact, resume | Catch overflow during generation |

**Goal:** Never abort at 100%, always compact proactively.

**Critical:** Tool response monitoring prevents LMStudio's "cut middle" behavior.
