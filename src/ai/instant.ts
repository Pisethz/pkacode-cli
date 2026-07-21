import type { Config } from '../config/types.js';
import type { AIProvider, ChatCompletionOptions, ChatCompletionResult } from './provider.js';
import { registerProvider } from './provider.js';

const INSTANT_SERVER = 'http://localhost:3721';

/** Check if the local server is running and has instant mode. */
export async function checkInstantMode(): Promise<{ available: boolean; remaining: number; limit: number }> {
  try {
    const res = await fetch(`${INSTANT_SERVER}/api/providers`, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return { available: false, remaining: 0, limit: 0 };
    const data = await res.json() as { instantMode?: { enabled: boolean; remaining: number; limit: number } };
    if (data.instantMode?.enabled) {
      return { available: true, remaining: data.instantMode.remaining, limit: data.instantMode.limit };
    }
    return { available: false, remaining: 0, limit: 0 };
  } catch {
    return { available: false, remaining: 0, limit: 0 };
  }
}

/** Instant mode provider — proxies through local server. */
export class InstantProvider implements AIProvider {
  readonly name = 'instant';
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const messages = options.messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
      content: typeof m.content === 'string' ? m.content : '',
    }));

    const res = await fetch(`${INSTANT_SERVER}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        provider: this.config.provider,
        model: this.config.model,
        apiKeys: {},
        maxTokens: this.config.maxTokens,
        temperature: this.config.temperature,
      }),
      signal: options.signal,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Server error' })) as { error?: string };
      throw new Error(err.error || `Server error: ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';
        for (const block of parts) {
          const lines = block.split('\n');
          let type = '', data = '';
          for (const l of lines) {
            const t = l.trim();
            if (t.startsWith('event: ')) type = t.slice(7);
            else if (t.startsWith('data: ')) data = t.slice(6);
          }
          if (!data) continue;
          try {
            const d = JSON.parse(data);
            if (type === 'chunk' && d.content) {
              fullContent += d.content;
              options.onStream?.(d.content);
            } else if (type === 'reasoning' && d.content) {
              options.onStreamReasoning?.(d.content);
            } else if (type === 'done' && d.usage) {
              options.onUsage?.({
                promptTokens: d.usage.promptTokens || 0,
                completionTokens: d.usage.completionTokens || 0,
                totalTokens: d.usage.totalTokens || 0,
              });
            } else if (type === 'error') {
              throw new Error(d.message || 'AI error');
            }
          } catch (e: unknown) {
            if (!(e instanceof SyntaxError)) throw e;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return { content: fullContent };
  }

  async listModels(): Promise<string[]> {
    return ['deepseek/deepseek-v4-flash:free'];
  }
}

registerProvider('instant', InstantProvider);
