import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import chalk from 'chalk';
import type { Config, ProviderName } from '../config/types.js';
import { PROVIDER_NAMES, isPaidLegacyProvider } from '../config/types.js';
import { loadConfig, saveConfig, getApiKeyForProvider } from '../config/store.js';
import { clearOAuthTokens, loadOAuthTokens, isOAuthExpired } from './oauth/store.js';

export function isValidProvider(name: string): name is ProviderName {
  if (isPaidLegacyProvider(name)) return false;
  return PROVIDER_NAMES.includes(name as ProviderName);
}

export async function promptApiKey(provider: ProviderName): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    const key = await rl.question(chalk.cyan(`  Enter FREE API key for ${provider}: `));
    return key.trim();
  } finally {
    rl.close();
  }
}

export async function loginProvider(provider: ProviderName, key?: string): Promise<Config> {
  if (!isValidProvider(provider)) {
    throw new Error('PKA is FREE-only. Use gemini, groq, or openrouter.');
  }
  const config = loadConfig();
  const apiKey = key || (await promptApiKey(provider));
  if (!apiKey) {
    throw new Error('API key cannot be empty.');
  }
  config.apiKeys[provider] = apiKey;
  saveConfig(config);
  return config;
}

export function logoutProvider(provider: ProviderName): Config {
  const config = loadConfig();
  if (isValidProvider(provider)) {
    config.apiKeys[provider] = '';
    saveConfig(config);
    clearOAuthTokens(provider);
  }
  return config;
}

function oauthStatus(provider: ProviderName, key: string): string {
  const tokens = loadOAuthTokens(provider);
  if (tokens && !isOAuthExpired(tokens)) {
    if (provider === 'gemini') {
      return tokens.accessToken.startsWith('AIza')
        ? chalk.green('FREE · AI Studio')
        : chalk.green('FREE · Google OAuth');
    }
    if (provider === 'groq') return chalk.green('FREE');
    if (provider === 'openrouter') return chalk.green('FREE models');
  }
  if (tokens) return chalk.yellow('expired — run /pka auth login');
  if (key) return chalk.green(`FREE key (****${key.slice(-4)})`);
  return chalk.dim('not set');
}

export function printAuthStatus(config = loadConfig()): void {
  console.log(chalk.bold.cyan('\n  Auth Status (FREE-only)\n'));
  console.log(chalk.dim('  Paid providers disabled: Claude · ChatGPT\n'));
  for (const name of PROVIDER_NAMES) {
    const key = getApiKeyForProvider(config, name);
    console.log(`  ${name.padEnd(12)}  ${oauthStatus(name, key)}`);
  }
  console.log('');
}
