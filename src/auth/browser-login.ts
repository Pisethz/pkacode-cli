import { exec } from 'node:child_process';
import { platform } from 'node:os';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import chalk from 'chalk';
import type { ProviderName } from '../config/types.js';

/** Free-only provider console URLs. */
export const PROVIDER_LOGIN_URLS: Record<ProviderName, { login: string; keys: string; label: string }> = {
  gemini: {
    label: 'Google AI Studio (Gemini FREE)',
    login: 'https://accounts.google.com/',
    keys: 'https://aistudio.google.com/apikey',
  },
  groq: {
    label: 'Groq (FREE)',
    login: 'https://console.groq.com/login',
    keys: 'https://console.groq.com/keys',
  },
  openrouter: {
    label: 'OpenRouter (FREE models)',
    login: 'https://openrouter.ai/sign-in',
    keys: 'https://openrouter.ai/keys',
  },
  openrouter2: {
    label: 'OpenRouter 2 (DeepSeek Flash)',
    login: 'https://openrouter.ai/sign-in',
    keys: 'https://openrouter.ai/keys',
  },
};

export function openInBrowser(url: string): void {
  const cmd =
    platform() === 'win32' ? `start "" "${url}"` :
    platform() === 'darwin' ? `open "${url}"` :
    `xdg-open "${url}"`;

  exec(cmd, (err) => {
    if (err) {
      console.log(chalk.yellow(`\n  Could not open browser automatically.`));
      console.log(chalk.dim(`  Open this URL manually:\n    ${url}\n`));
    }
  });
}

export async function browserLoginAndCaptureKey(provider: ProviderName): Promise<string | null> {
  const info = PROVIDER_LOGIN_URLS[provider];
  console.log(chalk.cyan(`\n  Opening ${info.label}…`));
  openInBrowser(info.keys);
  const rl = createInterface({ input, output });
  try {
    const key = (await rl.question(chalk.cyan('  Paste FREE API key: '))).trim();
    return key || null;
  } finally {
    rl.close();
  }
}
