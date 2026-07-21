import { execSync } from 'node:child_process';
import chalk from 'chalk';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { openInBrowser } from './browser-login.js';

/** Read OS clipboard (Windows / macOS / Linux common tools). */
export function readClipboard(): string {
  try {
    if (process.platform === 'win32') {
      return execSync('powershell -NoProfile -Command "Get-Clipboard"', {
        encoding: 'utf8',
        timeout: 3000,
        windowsHide: true,
      }).trim();
    }
    if (process.platform === 'darwin') {
      return execSync('pbpaste', { encoding: 'utf8', timeout: 3000 }).trim();
    }
    return execSync('xclip -selection clipboard -o 2>/dev/null || xsel --clipboard --output 2>/dev/null || wl-paste 2>/dev/null', {
      encoding: 'utf8',
      timeout: 3000,
      shell: '/bin/sh',
    }).trim();
  } catch {
    return '';
  }
}

/**
 * Open free-tier signup page, then auto-detect key from clipboard (or fallback prompt).
 * Avoids forcing users to type the key into the CLI when they can Copy in the browser.
 */
export async function browserFreeLoginCaptureKey(opts: {
  providerLabel: string;
  signupUrl: string;
  tip: string;
  match: (text: string) => string | null;
  timeoutMs?: number;
}): Promise<string | null> {
  const timeoutMs = opts.timeoutMs ?? 5 * 60_000;

  console.log('');
  console.log(chalk.bold.cyan(`  Sign in to ${opts.providerLabel} (free)`));
  console.log(chalk.dim('  ─────────────────────────────────────────────'));
  console.log(chalk.white(`  1. Browser opens free account / key page.`));
  console.log(chalk.white(`  2. Log in with Google / email.`));
  console.log(chalk.white(`  3. Click Create / Copy key — PKA detects it from clipboard.`));
  console.log(chalk.dim(`  ${opts.tip}`));
  console.log(chalk.dim('  ─────────────────────────────────────────────'));
  console.log('');

  openInBrowser(opts.signupUrl);
  console.log(chalk.dim(`  Waiting for clipboard key… (you can also paste below)\n`));

  const start = Date.now();
  let last = '';
  const rl = createInterface({ input, output });

  try {
    const pastePromise = rl.question(chalk.cyan('  Paste key here if auto-detect misses it (or wait): '));

    while (Date.now() - start < timeoutMs) {
      const clip = readClipboard();
      if (clip && clip !== last) {
        last = clip;
        const matched = opts.match(clip);
        if (matched) {
          console.log(chalk.green('\n  ✓ Detected key from clipboard — no typing needed.\n'));
          return matched;
        }
      }

      // Check if user finished typing (non-blocking race)
      const raced = await Promise.race([
        pastePromise.then(line => ({ type: 'paste' as const, line })),
        new Promise<{ type: 'tick' }>(r => setTimeout(() => r({ type: 'tick' }), 800)),
      ]);

      if (raced.type === 'paste') {
        const typed = raced.line.trim();
        const matched = typed ? opts.match(typed) || (typed.length > 8 ? typed : null) : null;
        if (matched) {
          console.log(chalk.green('  ✓ Key captured.\n'));
          return matched;
        }
        if (!typed) continue;
        console.log(chalk.yellow('  That does not look like a key — try again or wait for clipboard.'));
      }
    }

    console.log(chalk.red('\n  Timed out waiting for a key.\n'));
    return null;
  } finally {
    rl.close();
  }
}
