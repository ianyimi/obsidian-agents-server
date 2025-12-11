// OpenAI Chat Completions API Types
// Documentation: https://platform.openai.com/docs/api-reference/chat

// ============================================================================
// Common/Shared Types
// ============================================================================

// Message Content Part Types
export interface TextContentPart {
  type: "text";
  text: string;
}

export interface ImageContentPart {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
}

export interface AudioContentPart {
  type: "input_audio";
  input_audio: {
    data: string;
    format: "wav" | "mp3";
  };
}

export interface FileContentPart {
  type: "file";
  file: {
    file_data?: string;
    file_id?: string;
    filename?: string;
  };
}

export interface RefusalContentPart {
  type: "refusal";
  refusal: string;
}

export type MessageContentPart =
  | TextContentPart
  | ImageContentPart
  | AudioContentPart
  | FileContentPart
  | RefusalContentPart;

// Message Types
export interface DeveloperMessage {
  role: "developer";
  content: string | TextContentPart[];
  name?: string;
}

export interface SystemMessage {
  role: "system";
  content: string | TextContentPart[];
  name?: string;
}

export interface UserMessage {
  role: "user";
  content: string | MessageContentPart[];
  name?: string;
}

export interface FunctionCall {
  name: string;
  arguments: string;
}

export interface FunctionToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface CustomToolCall {
  id: string;
  type: "custom";
  custom: {
    name: string;
    input: string;
  };
}

export type ToolCall = FunctionToolCall | CustomToolCall;

export interface AssistantMessage {
  role: "assistant";
  content?: string | (TextContentPart | RefusalContentPart)[];
  refusal?: string;
  name?: string;
  audio?: {
    id: string;
  };
  tool_calls?: ToolCall[];
  /** @deprecated Use tool_calls instead */
  function_call?: FunctionCall;
}

export interface ToolMessage {
  role: "tool";
  content: string | TextContentPart[];
  tool_call_id: string;
}

/** @deprecated */
export interface FunctionMessage {
  role: "function";
  content: string;
  name: string;
}

export type ChatCompletionMessage =
  | DeveloperMessage
  | SystemMessage
  | UserMessage
  | AssistantMessage
  | ToolMessage
  | FunctionMessage;

// Tool Definition Types
export interface FunctionTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: object;
    strict?: boolean;
  };
}

export interface CustomTool {
  type: "custom";
  custom: {
    name: string;
    description?: string;
    format?: {
      type: "text";
    } | {
      type: "grammar";
      grammar: {
        syntax: "lark" | "regex";
        definition: string;
      };
    };
  };
}

export type Tool = FunctionTool | CustomTool;

// Tool Choice Types
export type ToolChoiceMode = "none" | "auto" | "required";

export interface AllowedTools {
  type: "allowed_tools";
  allowed_tools: {
    mode: "auto" | "required";
    tools: Array<{
      type: "function";
      function: {
        name: string;
      };
    }>;
  };
}

export interface FunctionToolChoice {
  type: "function";
  function: {
    name: string;
  };
}

export interface CustomToolChoice {
  type: "custom";
  custom: {
    name: string;
  };
}

export type ToolChoice = ToolChoiceMode | AllowedTools | FunctionToolChoice | CustomToolChoice;

// Response Format Types
export interface TextResponseFormat {
  type: "text";
}

export interface JsonSchemaResponseFormat {
  type: "json_schema";
  json_schema: {
    name: string;
    description?: string;
    schema?: object;
    strict?: boolean;
  };
}

export interface JsonObjectResponseFormat {
  type: "json_object";
}

export type ResponseFormat = TextResponseFormat | JsonSchemaResponseFormat | JsonObjectResponseFormat;

// Audio Types
export interface AudioParameters {
  voice: "alloy" | "ash" | "ballad" | "coral" | "echo" | "fable" | "nova" | "onyx" | "sage" | "shimmer";
  format: "wav" | "mp3" | "flac" | "opus" | "pcm16";
}

export interface AudioResponse {
  id: string;
  data: string;
  transcript: string;
  expires_at: number;
}

// Prediction Types
export interface StaticContentPrediction {
  type: "content";
  content: string | TextContentPart[];
}

export type Prediction = StaticContentPrediction;

// Stream Options
export interface StreamOptions {
  include_usage?: boolean;
  include_obfuscation?: boolean;
}

// Web Search Options
export interface WebSearchOptions {
  search_context_size?: "low" | "medium" | "high";
  user_location?: {
    type: "approximate";
    approximate: {
      city?: string;
      country?: string;
      region?: string;
      timezone?: string;
    };
  } | null;
}

// Function Call Control (Deprecated)
export type FunctionCallControl = "none" | "auto" | { name: string };

// Logprobs Types
export interface TokenLogprob {
  token: string;
  logprob: number;
  bytes: number[] | null;
}

export interface TopLogprob {
  token: string;
  logprob: number;
  bytes: number[] | null;
}

export interface ContentTokenLogprob extends TokenLogprob {
  top_logprobs: TopLogprob[];
}

export interface RefusalTokenLogprob extends TokenLogprob {
  top_logprobs: TopLogprob[];
}

export interface Logprobs {
  content: ContentTokenLogprob[] | null;
  refusal: RefusalTokenLogprob[] | null;
}

// Usage Types
export interface PromptTokensDetails {
  cached_tokens: number;
  audio_tokens: number;
}

export interface CompletionTokensDetails {
  reasoning_tokens: number;
  audio_tokens: number;
  accepted_prediction_tokens: number;
  rejected_prediction_tokens: number;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_tokens_details: PromptTokensDetails;
  completion_tokens_details: CompletionTokensDetails;
}

// Annotation Types
export interface UrlCitationAnnotation {
  type: "url_citation";
  url_citation: {
    url: string;
    title: string;
    start_index: number;
    end_index: number;
  };
}

export type Annotation = UrlCitationAnnotation;

// Choice Types
export interface ChatCompletionChoice {
  index: number;
  message: {
    role: "assistant";
    content: string | null;
    refusal: string | null;
    tool_calls?: ToolCall[] | null;
    /** @deprecated */
    function_call?: FunctionCall | null;
    audio?: AudioResponse;
    annotations?: Annotation[];
  };
  finish_reason: "stop" | "length" | "content_filter" | "tool_calls" | "function_call";
  logprobs: Logprobs | null;
}

// ============================================================================
// GET /v1/models - Get Models
// ============================================================================

export type GetModelsResponse = {
  id: string;
  object: string;
  owned_by: string;
}[]

// ============================================================================
// POST /v1/chat/completions - Create Chat Completion
// ============================================================================

export interface CreateChatCompletionBody {
  model: string;
  messages: ChatCompletionMessage[];
  audio?: AudioParameters | null;
  frequency_penalty?: number | null;
  /** @deprecated Use tool_choice instead */
  function_call?: FunctionCallControl;
  /** @deprecated Use tools instead */
  functions?: Array<{
    name: string;
    description?: string;
    parameters?: object;
  }>;
  logit_bias?: Record<string, number> | null;
  logprobs?: boolean | null;
  max_completion_tokens?: number | null;
  /** @deprecated Use max_completion_tokens instead */
  max_tokens?: number | null;
  metadata?: Record<string, string>;
  modalities?: Array<"text" | "audio">;
  n?: number | null;
  parallel_tool_calls?: boolean;
  prediction?: Prediction;
  presence_penalty?: number | null;
  prompt_cache_key?: string;
  prompt_cache_retention?: "24h";
  reasoning_effort?: "none" | "minimal" | "low" | "medium" | "high";
  response_format?: ResponseFormat;
  safety_identifier?: string;
  /** @deprecated */
  seed?: number | null;
  service_tier?: "auto" | "default" | "flex" | "priority";
  stop?: string | string[] | null;
  store?: boolean | null;
  stream?: boolean | null;
  stream_options?: StreamOptions | null;
  temperature?: number;
  tool_choice?: ToolChoice;
  tools?: Tool[];
  top_logprobs?: number;
  top_p?: number;
  /** @deprecated Use prompt_cache_key or safety_identifier instead */
  user?: string;
  verbosity?: "low" | "medium" | "high";
  web_search_options?: WebSearchOptions;
}

export interface CreateChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: Usage;
  service_tier?: "auto" | "default" | "flex" | "priority";
  /** @deprecated */
  system_fingerprint?: string;
}

// ============================================================================
// GET /v1/chat/completions/{completion_id} - Get Chat Completion
// ============================================================================

export interface GetChatCompletionPathParams {
  completion_id: string;
}

export interface GetChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  request_id: string;
  tool_choice: ToolChoice | null;
  usage: Usage;
  seed?: number | null;
  top_p: number;
  temperature: number;
  presence_penalty: number;
  frequency_penalty: number;
  system_fingerprint: string;
  input_user: string | null;
  service_tier: string;
  tools: Tool[] | null;
  metadata: Record<string, string>;
  choices: ChatCompletionChoice[];
  response_format: ResponseFormat | null;
}

// ============================================================================
// GET /v1/chat/completions/{completion_id}/messages - Get Chat Messages
// ============================================================================

export interface GetChatMessagesPathParams {
  completion_id: string;
}

export interface GetChatMessagesQueryParams {
  after?: string;
  limit?: number;
  order?: "asc" | "desc";
}

export interface ChatCompletionMessageItem {
  id: string;
  role: string;
  content: string | null;
  refusal?: string | null;
  name?: string | null;
  content_parts?: (TextContentPart | ImageContentPart)[] | null;
  audio?: AudioResponse;
  /** @deprecated */
  function_call?: FunctionCall;
  tool_calls?: ToolCall[];
}

export interface GetChatMessagesResponse {
  object: "list";
  data: ChatCompletionMessageItem[];
  first_id: string;
  last_id: string;
  has_more: boolean;
}

// ============================================================================
// GET /v1/chat/completions - List Chat Completions
// ============================================================================

export interface ListChatCompletionsQueryParams {
  after?: string;
  limit?: number;
  metadata?: Record<string, string> | null;
  model?: string;
  order?: "asc" | "desc";
}

export interface ListChatCompletionsResponse {
  object: "list";
  data: GetChatCompletionResponse[];
  first_id: string;
  last_id: string;
  has_more: boolean;
}

// ============================================================================
// POST /v1/chat/completions/{completion_id} - Update Chat Completion
// ============================================================================

export interface UpdateChatCompletionPathParams {
  completion_id: string;
}

export interface UpdateChatCompletionBody {
  metadata: Record<string, string>;
}

export interface UpdateChatCompletionResponse extends GetChatCompletionResponse { }

// ============================================================================
// DELETE /v1/chat/completions/{completion_id} - Delete Chat Completion
// ============================================================================

export interface DeleteChatCompletionPathParams {
  completion_id: string;
}

export interface DeleteChatCompletionResponse {
  object: "chat.completion.deleted";
  id: string;
  deleted: boolean;
}

// ============================================================================
// Streaming Types (for stream: true)
// ============================================================================

export interface ChatCompletionChunkChoice {
  index: number;
  delta: {
    role?: "assistant";
    content?: string;
    refusal?: string;
    tool_calls?: Array<{
      index: number;
      id?: string;
      type?: "function" | "custom";
      function?: {
        name?: string;
        arguments?: string;
      };
      custom?: {
        name?: string;
        input?: string;
      };
    }>;
    /** @deprecated */
    function_call?: {
      name?: string;
      arguments?: string;
    };
  };
  finish_reason: "stop" | "length" | "content_filter" | "tool_calls" | "function_call" | null;
  logprobs?: Logprobs | null;
}

export interface ChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: ChatCompletionChunkChoice[];
  usage?: Usage | null;
  service_tier?: string;
  /** @deprecated */
  system_fingerprint?: string;
}
