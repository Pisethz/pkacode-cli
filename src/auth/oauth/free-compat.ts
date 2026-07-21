import { saveOAuthTokens, loadOAuthTokens, type OAuthTokens } from './store.js';
import { loadConfig, saveConfig } from '../../config/store.js';
import { browserFreeLoginCaptureKey } from '../clipboard-login.js';
import type { ProviderName } from '../../config/types.js';
import { DEFAULT_API_BASES, DEFAULT_MODELS } from '../../config/types.js';

/** Groq + OpenRouter free browser login (clipboard key capture). */
export async function loginFreeCompatProvider(
  provider: 'groq' | 'openrouter'
): Promise<OAuthTokens> {
  const meta =
    provider === 'groq'
      ? {
          label: 'Groq (FREE — no credit card)',
          url: 'https://console.groq.com/keys',
          tip: 'Google/email signup → Create API Key → Copy. Truly free with rate limits.',
          match: (text: string) => {
            const m = text.match(/gsk_[A-Za-z0-9]{20,}/);
            return m ? m[0] : null;
          },
        }
      : {
          label: 'OpenRouter (FREE models)',
          url: 'https://openrouter.ai/keys',
          tip: 'Sign up free → Create key → Copy. Use models ending in :free (default openrouter/free).',
          match: (text: string) => {
            const m = text.match(/sk-or-v1-[A-Za-z0-9]{20,}/);
            return m ? m[0] : null;
          },
        };

  const key = await browserFreeLoginCaptureKey({
    providerLabel: meta.label,
    signupUrl: meta.url,
    tip: meta.tip,
    match: meta.match,
  });

  if (!key) throw new Error(`Cancelled — no ${provider} key.`);

  const cfg = loadConfig();
  cfg.apiKeys[provider] = key;
  cfg.apiBase = DEFAULT_API_BASES[provider];
  cfg.provider = provider as ProviderName;
  cfg.model = DEFAULT_MODELS[provider];
  saveConfig(cfg);

  const tokens: OAuthTokens = {
    provider: provider as ProviderName,
    accessToken: key,
    refreshToken: '',
    expiresAt: Date.now() + 365 * 24 * 3600 * 1000,
  };
  saveOAuthTokens(tokens);
  return tokens;
}
