import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import chalk from 'chalk';
import type { ProviderName } from '../config/types.js';
import { PROVIDER_NAMES, DEFAULT_API_BASES, DEFAULT_MODELS, isPaidLegacyProvider } from '../config/types.js';
import {
  loadConfig,
  saveConfig,
  resolveModelAlias,
  getApiKeyForProvider,
  ensureFreeModel,
  MODELS_CACHE_PATH,
  ensureConfigDirs,
} from '../config/store.js';
import { createProvider } from '../ai/provider.js';
import '../ai/gemini.js';
import '../ai/groq.js';
import '../ai/openrouter.js';
import '../ai/openrouter2.js';

export interface ModelsCache {
  updatedAt: string;
  models: Partial<Record<ProviderName, string[]>>;
}

export function loadModelsCache(): ModelsCache {
  try {
    if (existsSync(MODELS_CACHE_PATH)) {
      return JSON.parse(readFileSync(MODELS_CACHE_PATH, 'utf-8')) as ModelsCache;
    }
  } catch {
    // ignore
  }
  return { updatedAt: '', models: {} };
}

export function saveModelsCache(cache: ModelsCache): void {
  ensureConfigDirs();
  writeFileSync(MODELS_CACHE_PATH, JSON.stringify(cache, null, 2));
}

export async function fetchModelsForProvider(provider: ProviderName): Promise<string[]> {
  const config = loadConfig();
  const cfg = {
    ...config,
    provider,
    model: ensureFreeModel(provider, DEFAULT_MODELS[provider]),
    apiBase: DEFAULT_API_BASES[provider],
  };

  try {
    const p = createProvider(cfg);
    return (await p.listModels?.()) || [];
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(chalk.yellow(`  (${provider}: ${msg})`));
    return [];
  }
}

export async function refreshAllModels(filter?: ProviderName): Promise<ModelsCache> {
  const providers = filter ? [filter] : PROVIDER_NAMES;
  const cache = loadModelsCache();
  cache.updatedAt = new Date().toISOString();

  for (const provider of providers) {
    process.stdout.write(chalk.dim(`  Fetching ${provider} free models... `));
    const models = await fetchModelsForProvider(provider);
    cache.models[provider] = models;
    console.log(chalk.green(`${models.length} found`));
  }

  saveModelsCache(cache);
  return cache;
}

export function pinModel(alias: string, model: string): void {
  const config = loadConfig();
  config.pins[alias] = model;
  saveConfig(config);
}

export function setProvider(name: ProviderName | string): void {
  if (isPaidLegacyProvider(name)) {
    throw new Error(
      `PKA is FREE-only. "${name}" is disabled. Use: gemini | groq | openrouter`
    );
  }
  if (!PROVIDER_NAMES.includes(name as ProviderName)) {
    throw new Error(`Unknown provider. FREE only: ${PROVIDER_NAMES.join(', ')}`);
  }
  const provider = name as ProviderName;
  const config = loadConfig();
  config.provider = provider;
  config.apiBase = DEFAULT_API_BASES[provider];
  config.model = ensureFreeModel(provider, config.model);
  const m = config.model.toLowerCase();
  const mismatch =
    (provider === 'gemini' && !m.includes('gemini')) ||
    (provider === 'groq' && (m.includes('gemini') || m.includes('openrouter') || m.includes(':'))) ||
    (provider === 'openrouter' && !m.includes('/') && !m.includes('openrouter'));
  if (mismatch) {
    config.model = DEFAULT_MODELS[provider];
  }
  saveConfig(config);
}

export function setModel(name: string): void {
  const config = loadConfig();
  let model = resolveModelAlias(config, name);
  if (config.pins[name]) {
    model = config.pins[name];
  }
  config.model = ensureFreeModel(config.provider, model);
  saveConfig(config);
}
