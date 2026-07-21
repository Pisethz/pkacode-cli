import type { Config } from '../config/types.js';
import type { AIProvider, ChatCompletionOptions, ChatCompletionResult } from './provider.js';
import { registerProvider } from './provider.js';
import { OpenAICompatProvider } from './openai-compat.js';
import { DEFAULT_API_BASES, DEFAULT_MODELS } from '../config/types.js';

/** Groq — free tier, no credit card (rate-limited). OpenAI-compatible. */
export class GroqProvider implements AIProvider {
  readonly name = 'groq';
  private inner: OpenAICompatProvider;

  constructor(config: Config) {
    const cfg = { ...config };
    cfg.apiBase = DEFAULT_API_BASES.groq;
    if (!cfg.model || cfg.model.includes('gemini') || cfg.model.includes('openrouter') || cfg.model.includes(':')) {
      cfg.model = DEFAULT_MODELS.groq;
    }
    this.inner = new OpenAICompatProvider(cfg, { name: 'groq', keyProvider: 'groq' });
  }

  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    return this.inner.chat(options);
  }

  async listModels(): Promise<string[]> {
    return this.inner.listModels();
  }
}

registerProvider('groq', GroqProvider);
