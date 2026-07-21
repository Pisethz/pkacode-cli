import type { ToolDefinition } from '../tools/registry.js';
import type { Config } from '../config/types.js';

// ── Message types ───────────────────────────────────────────

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface TextContent {
  type: 'text';
  text: string;
}

export interface ToolCallContent {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type MessageContent = string | TextContent[];

export interface Message {
  role: MessageRole;
  content: MessageContent;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolResult {
  toolCallId: string;
  name: string;
  result: string;
}

// ── Provider interface ──────────────────────────────────────

export interface ChatCompletionOptions {
  messages: Message[];
  tools: ToolDefinition[];
  onStream?: (chunk: string) => void;
  onStreamReasoning?: (chunk: string) => void;
  onUsage?: (usage: { promptTokens: number; completionTokens: number; totalTokens: number }) => void;
  signal?: AbortSignal;
}

export interface ChatCompletionResult {
  content: string;
  toolCalls?: ToolCall[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIProvider {
  readonly name: string;
  chat(options: ChatCompletionOptions): Promise<ChatCompletionResult>;
  listModels?(): Promise<string[]>;
}

// ── Factory ─────────────────────────────────────────────────

export type ProviderConstructor = new (config: Config) => AIProvider;

const providers = new Map<string, ProviderConstructor>();

export function registerProvider(name: string, ctor: ProviderConstructor): void {
  providers.set(name, ctor);
}

export function createProvider(config: Config): AIProvider {
  const Ctor = providers.get(config.provider);
  if (!Ctor) {
    throw new Error(
      `Unknown provider: "${config.provider}". Available: ${[...providers.keys()].join(', ')}`
    );
  }
  return new Ctor(config);
}

export function getProviderNames(): string[] {
  return [...providers.keys()];
}
