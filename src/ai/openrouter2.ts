import type { Config } from '../config/types.js';
import type { AIProvider, ChatCompletionOptions, ChatCompletionResult } from './provider.js';
import { registerProvider } from './provider.js';
import { OpenAICompatProvider } from './openai-compat.js';
import { DEFAULT_API_BASES, DEFAULT_MODELS } from '../config/types.js';

/** OpenRouter 2 — DeepSeek V4 Flash via OpenRouter. OpenAI-compatible. */
export class OpenRouter2Provider implements AIProvider {
  readonly name = 'openrouter2';
  private inner: OpenAICompatProvider;

  constructor(config: Config) {
    const cfg = { ...config };
    cfg.apiBase = DEFAULT_API_BASES.openrouter2;
    if (!cfg.model) {
      cfg.model = DEFAULT_MODELS.openrouter2;
    }
    this.inner = new OpenAICompatProvider(cfg, { name: 'openrouter2', keyProvider: 'openrouter2' });
  }

  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    return this.inner.chat(options);
  }

  async listModels(): Promise<string[]> {
    return this.inner.listModels();
  }
}

registerProvider('openrouter2', OpenRouter2Provider);
