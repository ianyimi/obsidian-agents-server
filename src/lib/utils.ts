import { AgentInputItem, RunResult, StreamedRunResult } from "@openai/agents";
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { ChatCompletionMessage, CreateChatCompletionResponse, ChatCompletionChoice, ChatCompletionChunk } from "~/agents/chatCompletionApiTypes";
import { VAULT_TOOLS } from "~/tools/vault";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format a tool name for display
 * Converts snake_case to Title Case
 * Example: "ref_search_documentation" -> "Ref Search Documentation"
 */
function formatToolName(name: string): string {
  return name
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function convertMessagesToAgentInput(messages: ChatCompletionMessage[]): AgentInputItem[] {
  return messages.map((msg) => {
    const contentText = typeof msg.content === 'string'
      ? msg.content
      : Array.isArray(msg.content)
        ? msg.content.map(part => 'text' in part ? part.text : '').join('\n')
        : '';

    switch (msg.role) {
      case 'developer':
      case 'system':
        return {
          role: 'system' as const,
          content: contentText,
        } as AgentInputItem;
      case 'user':
        return {
          role: 'user' as const,
          content: contentText,
        } as AgentInputItem;
      case 'assistant':
        return {
          role: 'assistant' as const,
          status: 'completed' as const,
          content: contentText ? [{ type: 'output_text' as const, text: contentText }] : [],
        } as AgentInputItem;
      case 'tool':
        return {
          type: 'function_call_result' as const,
          callId: msg.tool_call_id,
          name: '',
          status: 'completed' as const,
          output: contentText,
        } as AgentInputItem;
      case 'function':
        return {
          type: 'function_call_result' as const,
          callId: msg.name,
          name: msg.name,
          status: 'completed' as const,
          output: msg.content,
        } as AgentInputItem;
      default:
        return {
          role: 'user' as const,
          content: contentText,
        } as AgentInputItem;
    }
  });
}

// Convert Agent SDK RunResult to OpenAI Chat Completion Response
export function convertRunResultToCompletion(
  result: RunResult<any, any>,
  model: string,
): CreateChatCompletionResponse {
  const outputItems = result.output || [];

  const lastAssistantMessage = outputItems
    .filter((item: any) => item.role === 'assistant')
    .pop();

  let content = '';
  if (lastAssistantMessage && 'content' in lastAssistantMessage) {
    if (Array.isArray(lastAssistantMessage.content)) {
      content = lastAssistantMessage.content
        .filter((part: any) => part.type === 'output_text' && part.text)
        .map((part: any) => part.text)
        .join('\n');
    }
  }

  // Build the choice
  const choice: ChatCompletionChoice = {
    index: 0,
    message: {
      role: 'assistant',
      content: content || null,
      refusal: null,
    },
    finish_reason: 'stop',
    logprobs: null,
  };

  // Build the response
  const response: CreateChatCompletionResponse = {
    id: result.lastResponseId || `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [choice],
    usage: {
      prompt_tokens: 0, // Agent SDK doesn't provide token counts
      completion_tokens: 0,
      total_tokens: 0,
      prompt_tokens_details: {
        cached_tokens: 0,
        audio_tokens: 0,
      },
      completion_tokens_details: {
        reasoning_tokens: 0,
        audio_tokens: 0,
        accepted_prediction_tokens: 0,
        rejected_prediction_tokens: 0,
      },
    },
  };

  return response;
}

export async function* convertStreamToChunks(
  stream: StreamedRunResult<any, any>,
  model: string,
): AsyncGenerator<ChatCompletionChunk> {
  const id = `chatcmpl-${Date.now()}`;
  const created = Math.floor(Date.now() / 1000);

  for await (const event of stream) {
    console.log('event recorded, stream usage: ', JSON.parse(JSON.stringify(stream.state._context.usage)))
    // Handle text deltas from model
    if (event.type === 'raw_model_stream_event' && event.data?.type === 'output_text_delta') {
      yield {
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [{
          index: 0,
          delta: {
            content: event.data.delta || '',
          },
          finish_reason: null,
          logprobs: null,
        }],
      };
    }
    // Handle SDK execution events (tool calls, handoffs, etc.)
    else if (event.type === 'run_item_stream_event') {
      const runEvent = event as any;

      // Tool call initiated
      if (runEvent.name === 'tool_called' && runEvent.item?.type === 'tool_call_item') {
        const funcName = runEvent.item.rawItem?.name || 'unknown';
        // Check if it's a vault tool for a friendly label
        const vaultTool = Object.values(VAULT_TOOLS).find(vt => vt.id === funcName);
        const displayName = vaultTool ? vaultTool.label : formatToolName(funcName);

        yield {
          id,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [{
            index: 0,
            delta: {
              content: `\n[Tool Call]: ${displayName}\n`,
            },
            finish_reason: null,
            logprobs: null,
          }],
        };
      }

      // Tool output received
      else if (runEvent.name === 'tool_output' && runEvent.item?.type === 'tool_call_output_item') {
        const funcName = runEvent.item.rawItem?.name || 'unknown';
        // Check if it's a vault tool for a friendly label
        const vaultTool = Object.values(VAULT_TOOLS).find(vt => vt.id === funcName);
        const displayName = vaultTool ? vaultTool.label : formatToolName(funcName);

        yield {
          id,
          object: 'chat.completion.chunk',
          created,
          model,
          choices: [{
            index: 0,
            delta: {
              content: `[Tool Complete]: ${displayName}\n`,
            },
            finish_reason: null,
            logprobs: null,
          }],
        };
      }
    }
  }

  // Log usage after stream completes
  console.log('[Stream Complete] Final usage:', stream.state._context.usage);

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
