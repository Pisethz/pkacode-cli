export type ProviderName = 'gemini' | 'groq' | 'openrouter' | 'openrouter2';

export type PermissionMode = 'default' | 'auto-edit' | 'plan' | 'yolo';

export type ToolCategory = 'bash' | 'fs' | 'net';

export interface ProviderApiKeys {
  gemini: string;
  groq: string;
  openrouter: string;
  openrouter2: string;
}

export interface Config {
  /** Active AI provider (free-only) */
  provider: ProviderName;
  /** Active model name (or pin alias) */
  model: string;
  /** OpenAI-compatible API base URL (groq / openrouter) */
  apiBase: string;
  /** Per-provider API keys */
  apiKeys: ProviderApiKeys;
  /** Legacy single key — migrated into apiKeys */
  apiKey?: string;
  /** Legacy Gemini key — migrated into apiKeys.gemini */
  geminiApiKey?: string;
  /** Named model aliases: pin alias → real model id */
  pins: Record<string, string>;
  /** System prompt for the AI */
  systemPrompt: string;
  /** Max tokens per response */
  maxTokens: number;
  /** Temperature for generation */
  temperature: number;
  /** Whether to stream responses */
  stream: boolean;
  /** Permission mode */
  permissionMode: PermissionMode;
  /** Extra directories granted file access */
  workspaceDirs: string[];
  /** Enabled tool categories */
  enabledTools: ToolCategory[];
  /** Sandbox preference (not enforced yet) */
  sandbox: boolean;
}

/** PKA is free-only: these are the only supported providers. */
export const PROVIDER_NAMES: ProviderName[] = ['gemini', 'groq', 'openrouter', 'openrouter2'];

export const FREE_PROVIDERS: ProviderName[] = PROVIDER_NAMES;

export const DEFAULT_MODELS: Record<ProviderName, string> = {
  gemini: 'gemini-2.0-flash',
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'openrouter/free',
  openrouter2: 'deepseek/deepseek-v4-flash',
};

/** Default provider and model shown on startup */
export const DEFAULT_PROVIDER: ProviderName = 'openrouter2';
export const DEFAULT_MODEL = DEFAULT_MODELS[DEFAULT_PROVIDER];

export const DEFAULT_API_BASES: Record<ProviderName, string> = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  groq: 'https://api.groq.com/openai',
  openrouter: 'https://openrouter.ai/api',
  openrouter2: 'https://openrouter.ai/api',
};

export function emptyApiKeys(): ProviderApiKeys {
  return { gemini: '', groq: '', openrouter: '', openrouter2: '' };
}

export function isProviderName(name: string): name is ProviderName {
  return PROVIDER_NAMES.includes(name as ProviderName);
}

/** Reject legacy paid providers (claude / openai). */
export function isPaidLegacyProvider(name: string): boolean {
  const n = name.toLowerCase().trim();
  return n === 'claude' || n === 'openai' || n === 'chatgpt' || n === 'anthropic';
}
