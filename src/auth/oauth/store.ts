import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { ensureConfigDirs, PKA_CONFIG_DIR } from '../../config/store.js';
import type { ProviderName } from '../../config/types.js';

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  provider: ProviderName;
  scope?: string;
}

function oauthDir(): string {
  const dir = join(PKA_CONFIG_DIR, 'oauth');
  ensureConfigDirs();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function tokenPath(provider: ProviderName): string {
  return join(oauthDir(), `${provider}.json`);
}

export function loadOAuthTokens(provider: ProviderName): OAuthTokens | null {
  try {
    const path = tokenPath(provider);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8')) as OAuthTokens;
  } catch {
    return null;
  }
}

export function saveOAuthTokens(tokens: OAuthTokens): void {
  writeFileSync(tokenPath(tokens.provider), JSON.stringify(tokens, null, 2));
}

export function clearOAuthTokens(provider: ProviderName): void {
  const path = tokenPath(provider);
  if (existsSync(path)) unlinkSync(path);
}

export function isOAuthExpired(tokens: OAuthTokens, skewMs = 60_000): boolean {
  return Date.now() >= tokens.expiresAt - skewMs;
}
