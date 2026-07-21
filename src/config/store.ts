import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import type { Config, ProviderName } from './types.js';
import {
  DEFAULT_API_BASES,
  DEFAULT_MODELS,
  DEFAULT_PROVIDER,
  DEFAULT_MODEL,
  emptyApiKeys,
  PROVIDER_NAMES,
  isProviderName,
  isPaidLegacyProvider,
} from './types.js';

/** Cross-platform config directory */
export function getPkaConfigDir(): string {
  if (platform() === 'win32') {
    // Windows: %APPDATA%\pka  (usually C:\Users\<user>\AppData\Roaming\pka)
    return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'pka');
  }
  // Linux / macOS: ~/.config/pka
  return join(homedir(), '.config', 'pka');
}

export const PKA_CONFIG_DIR = getPkaConfigDir();
export const PKA_CONFIG_PATH = join(PKA_CONFIG_DIR, 'config.json');
export const MODELS_CACHE_PATH = join(PKA_CONFIG_DIR, 'models-cache.json');
export const PERMISSIONS_PATH = join(PKA_CONFIG_DIR, 'permissions.json');
export const SESSIONS_DIR = join(PKA_CONFIG_DIR, 'sessions');

function getLegacyConfigDir(): string {
  if (platform() === 'win32') {
    return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'pkacode');
  }
  return join(homedir(), '.config', 'pkacode');
}

const LEGACY_CONFIG_DIR = getLegacyConfigDir();
const LEGACY_CONFIG_PATH = join(LEGACY_CONFIG_DIR, 'config.json');

const DEFAULT_SYSTEM_PROMPT = `You are PKA, a FREE multi-provider AI coding assistant in the user's terminal.
You only use free AI providers (Gemini, Groq, OpenRouter free models, DeepSeek).
You have access to their file system and can execute commands (subject to permissions).

## Capabilities
- Read, write, and edit files in the user's project
- Execute terminal commands to build, test, and run code
- Search for files and code patterns using glob
- Ask the user questions when you need clarification

## Guidelines
- Be concise and direct. Favor showing code over explaining it.
- Use edit_file for surgical changes when possible.
- Always check existing files before making changes.
- Run commands to verify changes (build, test, lint).
- Ask before destructive or risky operations.`;

export function getDefaultConfig(): Config {
  return {
    provider: DEFAULT_PROVIDER,
    model: DEFAULT_MODEL,
    apiBase: DEFAULT_API_BASES[DEFAULT_PROVIDER],
    apiKeys: emptyApiKeys(),
    pins: {},
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    maxTokens: 4096,
    temperature: 0.3,
    stream: true,
    permissionMode: 'default',
    workspaceDirs: [process.cwd()],
    enabledTools: ['bash', 'fs'],
    sandbox: false,
  };
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function ensureConfigDirs(): void {
  ensureDir(PKA_CONFIG_DIR);
  ensureDir(SESSIONS_DIR);
}

function migrateLegacyIfNeeded(): void {
  if (existsSync(PKA_CONFIG_PATH)) return;
  if (!existsSync(LEGACY_CONFIG_PATH)) return;

  ensureConfigDirs();
  try {
    copyFileSync(LEGACY_CONFIG_PATH, PKA_CONFIG_PATH);
  } catch {
    // ignore
  }
}

/** Ensure OpenRouter never uses a paid model id. */
export function ensureFreeModel(provider: ProviderName, model: string): string {
  if (provider === 'openrouter') {
    const m = (model || '').trim();
    if (!m) return DEFAULT_MODELS.openrouter;
    if (m === 'openrouter/free' || m.endsWith(':free') || m.endsWith('/free')) return m;
    return DEFAULT_MODELS.openrouter;
  }
  return model || DEFAULT_MODELS[provider];
}

function normalizeConfig(raw: Record<string, unknown>): Config {
  const defaults = getDefaultConfig();
  const rawKeys = (raw.apiKeys || {}) as Record<string, string>;

  const apiKeys = emptyApiKeys();
  apiKeys.gemini = rawKeys.gemini || (typeof raw.geminiApiKey === 'string' ? raw.geminiApiKey : '') || '';
  apiKeys.groq = rawKeys.groq || '';
  apiKeys.openrouter =
    rawKeys.openrouter ||
    (typeof rawKeys.openai === 'string' && rawKeys.openai.startsWith('sk-or-') ? rawKeys.openai : '') ||
    '';
  apiKeys.openrouter2 = rawKeys.openrouter2 || '';

  // Legacy flat apiKey → prefer gemini/openrouter if shapes match
  if (typeof raw.apiKey === 'string' && raw.apiKey) {
    if (raw.apiKey.startsWith('AIza') && !apiKeys.gemini) apiKeys.gemini = raw.apiKey;
    if (raw.apiKey.startsWith('gsk_') && !apiKeys.groq) apiKeys.groq = raw.apiKey;
    if (raw.apiKey.startsWith('sk-or-') && !apiKeys.openrouter) apiKeys.openrouter = raw.apiKey;
  }

  let providerRaw = String(raw.provider || DEFAULT_PROVIDER);
  if (isPaidLegacyProvider(providerRaw) || !isProviderName(providerRaw)) {
    // Prefer openrouter2 > openrouter > groq > gemini
    providerRaw = apiKeys.openrouter2 ? 'openrouter2' : apiKeys.openrouter ? 'openrouter' : apiKeys.groq ? 'groq' : DEFAULT_PROVIDER;
  }
  const normalizedProvider = providerRaw as ProviderName;

  const model = ensureFreeModel(
    normalizedProvider,
    (raw.model as string) || DEFAULT_MODELS[normalizedProvider]
  );

  return {
    ...defaults,
    ...raw,
    provider: normalizedProvider,
    model,
    apiBase: DEFAULT_API_BASES[normalizedProvider],
    apiKeys,
    pins: (raw.pins as Record<string, string>) || {},
    systemPrompt: (raw.systemPrompt as string) || defaults.systemPrompt,
    maxTokens: typeof raw.maxTokens === 'number' ? raw.maxTokens : defaults.maxTokens,
    temperature: typeof raw.temperature === 'number' ? raw.temperature : defaults.temperature,
    stream: typeof raw.stream === 'boolean' ? raw.stream : defaults.stream,
    permissionMode: (raw.permissionMode as Config['permissionMode']) || defaults.permissionMode,
    workspaceDirs: Array.isArray(raw.workspaceDirs)
      ? (raw.workspaceDirs as string[])
      : defaults.workspaceDirs,
    enabledTools: Array.isArray(raw.enabledTools)
      ? (raw.enabledTools as Config['enabledTools'])
      : defaults.enabledTools,
    sandbox: typeof raw.sandbox === 'boolean' ? raw.sandbox : false,
  };
}

export function loadConfig(): Config {
  migrateLegacyIfNeeded();
  try {
    if (existsSync(PKA_CONFIG_PATH)) {
      const data = JSON.parse(readFileSync(PKA_CONFIG_PATH, 'utf-8')) as Record<string, unknown>;
      return normalizeConfig(data);
    }
  } catch {
    // Fall through
  }
  return getDefaultConfig();
}

export function saveConfig(config: Config): void {
  ensureConfigDirs();
  const provider = isProviderName(config.provider) ? config.provider : 'gemini';
  const toSave: Config = {
    ...config,
    provider,
    model: ensureFreeModel(provider, config.model),
    apiBase: DEFAULT_API_BASES[provider],
    apiKeys: {
      gemini: config.apiKeys.gemini || '',
      groq: config.apiKeys.groq || '',
      openrouter: config.apiKeys.openrouter || '',
      openrouter2: config.apiKeys.openrouter2 || '',
    },
  };
  delete (toSave as { apiKey?: string }).apiKey;
  delete (toSave as { geminiApiKey?: string }).geminiApiKey;
  writeFileSync(PKA_CONFIG_PATH, JSON.stringify(toSave, null, 2));
}

export function getConfigPath(): string {
  return PKA_CONFIG_PATH;
}

export function getConfigDir(): string {
  return PKA_CONFIG_DIR;
}

export function resolveModelAlias(config: Config, name: string): string {
  return config.pins[name] || name;
}

export function getApiKeyForProvider(config: Config, provider: ProviderName): string {
  return config.apiKeys[provider] || '';
}

export function printConfig(config: Config): void {
  const mask = (k: string) => (k ? '****' + k.slice(-4) : '(not set)');
  console.log('── PKA Configuration (FREE-only) ──');
  console.log(`  Provider:          ${config.provider}`);
  console.log(`  Model:             ${config.model}`);
  console.log(`  API Base:          ${config.apiBase}`);
  console.log(`  Gemini Key:        ${mask(config.apiKeys.gemini)}`);
  console.log(`  Groq Key:          ${mask(config.apiKeys.groq)}`);
  console.log(`  OpenRouter Key:    ${mask(config.apiKeys.openrouter)}`);
  console.log(`  OpenRouter2 Key:   ${mask(config.apiKeys.openrouter2)}`);
  console.log(`  Permission Mode:   ${config.permissionMode}`);
  console.log(`  Enabled Tools:     ${config.enabledTools.join(', ')}`);
  console.log(`  Sandbox:           ${config.sandbox ? 'on (preference only)' : 'off'}`);
  console.log(`  Max Tokens:        ${config.maxTokens}`);
  console.log(`  Temperature:       ${config.temperature}`);
  console.log(`  Pins:              ${Object.keys(config.pins).length ? JSON.stringify(config.pins) : '(none)'}`);
  console.log('──────────────────────────────────');
  console.log(`Config file: ${getConfigPath()}`);
}
