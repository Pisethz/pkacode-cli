import type { Config } from '../config/types.js';
import type {
  AIProvider,
  ChatCompletionOptions,
  ChatCompletionResult,
  Message,
  ToolCall,
} from './provider.js';
import { getApiKeyForProvider } from '../config/store.js';
import type { ProviderName } from '../config/types.js';
import { DEFAULT_API_BASES } from '../config/types.js';

interface OpenAIMessage {
  role: string;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
  name?: string;
}

interface OpenAIChoice {
  index: number;
  message: OpenAIMessage;
  finish_reason: string;
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface OpenAIResponse {
  id: string;
  object: string;
  choices: OpenAIChoice[];
  usage?: OpenAIUsage;
}

interface OpenAIStreamChunk {
  id: string;
  object: string;
  choices: Array<{
    delta: {
      content?: string;
      reasoning_content?: string;
      reasoning?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: string | null;
    index: number;
  }>;
  usage?: OpenAIUsage;
}

export class OpenAICompatProvider implements AIProvider {
  readonly name: string;
  private baseUrl: string;
  private config: Config;
  private keyProvider: ProviderName;

  constructor(config: Config, opts?: { name?: string; keyProvider?: ProviderName }) {
    this.config = config;
    this.name = opts?.name || config.provider || 'groq';
    this.keyProvider = opts?.keyProvider || (config.provider === 'openrouter' ? 'openrouter' : config.provider === 'groq' ? 'groq' : 'groq');
    const defaultBase = DEFAULT_API_BASES[this.keyProvider] || DEFAULT_API_BASES.groq;
    this.baseUrl = (config.apiBase || defaultBase).replace(/\/+$/, '');
  }

  private getAuthHeader(): string | undefined {
    const key =
      getApiKeyForProvider(this.config, this.keyProvider) ||
      this.config.apiKey ||
      '';
    return key ? `Bearer ${key}` : undefined;
  }

  private convertMessages(messages: Message[]): OpenAIMessage[] {
    return messages.map(m => {
      const base: OpenAIMessage = {
        role: m.role,
        content: typeof m.content === 'string' ? m.content : null,
      };

      if (m.role === 'assistant' && m.tool_calls) {
        base.tool_calls = m.tool_calls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }));
      }

      if (m.role === 'tool') {
        base.tool_call_id = m.tool_call_id;
        base.name = m.name;
      }

      return base;
    });
  }

  private convertTools(tools: ChatCompletionOptions['tools']) {
    if (!tools || tools.length === 0) return undefined;
    return tools.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));
  }

  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const url = `${this.baseUrl}/v1/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const auth = this.getAuthHeader();
    if (auth) headers['Authorization'] = auth;

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: this.convertMessages(options.messages),
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      stream: options.onStream ? true : false,
    };

    if (options.onStream) {
      body.stream_options = { include_usage: true };
    }

    const tools = this.convertTools(options.tools);
    if (tools) body.tools = tools;

    if (options.onStream) {
      return this.streamChat(url, headers, body, options);
    } else {
      return this.nonStreamChat(url, headers, body);
    }
  }

  private async nonStreamChat(
    url: string,
    headers: Record<string, string>,
    body: Record<string, unknown>
  ): Promise<ChatCompletionResult> {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...body, stream: false }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} ${errBody}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content || '',
      toolCalls: choice?.message?.tool_calls?.length
        ? choice.message.tool_calls.map(tc => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          }))
        : undefined,
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
    };
  }

  private async streamChat(
    url: string,
    headers: Record<string, string>,
    body: Record<string, unknown>,
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResult> {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...body, stream: true }),
      signal: options.signal,
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText} ${errBody}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullContent = '';
    let toolCalls: Map<number, ToolCall> = new Map();
    let buffer = '';
    let usage: OpenAIUsage | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]') continue;

          try {
            const chunk = JSON.parse(jsonStr) as OpenAIStreamChunk;
            const delta = chunk.choices?.[0]?.delta;

            const reasoning =
              delta?.reasoning_content ||
              delta?.reasoning;
            if (reasoning) {
              options.onStreamReasoning?.(reasoning);
            }

            if (delta?.content) {
              fullContent += delta.content;
              options.onStream?.(delta.content);
            }

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (!toolCalls.has(tc.index)) {
                  toolCalls.set(tc.index, {
                    id: tc.id || `call_${tc.index}`,
                    type: 'function',
                    function: { name: '', arguments: '' },
                  });
                }
                const existing = toolCalls.get(tc.index)!;
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.function.name += tc.function.name;
                if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
              }
            }

            if (chunk.usage) {
              usage = chunk.usage;
              options.onUsage?.({
                promptTokens: chunk.usage.prompt_tokens,
                completionTokens: chunk.usage.completion_tokens,
                totalTokens: chunk.usage.total_tokens,
              });
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const toolCallsArray = toolCalls.size > 0 ? [...toolCalls.values()].filter(tc => tc.function.name) : undefined;

    return {
      content: fullContent,
      toolCalls: toolCallsArray?.length ? toolCallsArray : undefined,
      usage: usage
        ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          }
        : undefined,
    };
  }

  async listModels(): Promise<string[]> {
    try {
      const headers: Record<string, string> = {};
      const auth = this.getAuthHeader();
      if (auth) headers['Authorization'] = auth;
      const response = await fetch(`${this.baseUrl}/v1/models`, { headers });
      if (!response.ok) return [];
      const data = (await response.json()) as { data: Array<{ id: string }> };
      return data.data?.map(m => m.id) || [];
    } catch {
      return [];
    }
  }
}
