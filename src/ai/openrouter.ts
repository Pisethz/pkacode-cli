import type { Config } from '../config/types.js';
import type { AIProvider, ChatCompletionOptions, ChatCompletionResult } from './provider.js';
import { registerProvider } from './provider.js';
import { OpenAICompatProvider } from './openai-compat.js';
import { DEFAULT_API_BASES, DEFAULT_MODELS } from '../config/types.js';
import { ensureFreeModel } from '../config/store.js';

/**
 * OpenRouter — FREE models only.
 * Any non-:free model id is rewritten to openrouter/free.
 */
export class OpenRouterProvider implements AIProvider {
  readonly name = 'openrouter';
  private inner: OpenAICompatProvider;

  constructor(config: Config) {
    const cfg = { ...config };
    cfg.apiBase = DEFAULT_API_BASES.openrouter;
    cfg.model = ensureFreeModel('openrouter', cfg.model || DEFAULT_MODELS.openrouter);
    this.inner = new OpenAICompatProvider(cfg, { name: 'openrouter', keyProvider: 'openrouter' });
  }

  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    return this.inner.chat(options);
  }

  async listModels(): Promise<string[]> {
    const listed = await this.inner.listModels();
    const free = listed.filter(
      id => id.includes(':free') || id === 'openrouter/free' || id.endsWith('/free')
    );
    return free.length ? free.slice(0, 40) : ['openrouter/free', ...OPENROUTER_FALLBACK_IDS];
  }
}

const OPENROUTER_FALLBACK_IDS = [
  'openrouter/free',
  'google/gemini-2.0-flash-exp:free',
  'google/gemini-2.5-flash-exp:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'mistralai/mistral-nemo:free',
  'qwen/qwen-2.5-coder-32b-instruct:free',
  'deepseek/deepseek-chat:free',
  'microsoft/phi-3-medium:free',
  'cohere/command-r:free',
];

registerProvider('openrouter', OpenRouterProvider);
