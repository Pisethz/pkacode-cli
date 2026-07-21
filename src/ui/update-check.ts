import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import * as readline from 'node:readline';

let currentVersion = '';

function getCurrentVersion(): string {
  if (currentVersion) return currentVersion;
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(__dirname, '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    currentVersion = pkg.version || '0.0.0';
  } catch {
    currentVersion = '0.0.0';
  }
  return currentVersion;
}

function parseVersion(v: string): number[] {
  return v.split('.').map(Number);
}

function isNewer(latest: string, current: string): boolean {
  const l = parseVersion(latest);
  const c = parseVersion(current);
  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const lv = l[i] || 0;
    const cv = c[i] || 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

export interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  const current = getCurrentVersion();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://registry.npmjs.org/pkacode-cli/latest', {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return { hasUpdate: false, latestVersion: current, currentVersion: current };
    const data = await res.json() as { version?: string };
    const latest = data.version || current;
    return {
      hasUpdate: isNewer(latest, current),
      latestVersion: latest,
      currentVersion: current,
    };
  } catch {
    return { hasUpdate: false, latestVersion: current, currentVersion: current };
  }
}

function drawBox(latest: string, current: string, withChoices: boolean): void {
  const line1 = `  Update available: ${current} \u2192 ${latest}`;
  const line2 = withChoices ? '  [U]pdate now  [L]ater' : '';
  const innerWidth = Math.max(line1.length, line2.length);
  const border = '\u2500'.repeat(innerWidth + 2);
  console.log(`  \u250c${border}\u2510`);
  console.log(`  \u2502 ${line1.padEnd(innerWidth)} \u2502`);
  if (withChoices) {
    console.log(`  \u2502 ${line2.padEnd(innerWidth)} \u2502`);
  }
  console.log(`  \u2514${border}\u2518`);
}

function readOneKey(input: NodeJS.ReadStream): Promise<string> {
  return new Promise((resolve) => {
    const onKey = (_str: string, key: { name: string; sequence?: string }) => {
      input.removeListener('keypress', onKey);
      if (key.sequence === '\x03') {
        resolve('c');
        return;
      }
      resolve(key.sequence?.toLowerCase() || '');
    };
    readline.emitKeypressEvents(input);
    if (input.isTTY) input.setRawMode(true);
    input.on('keypress', onKey);
  });
}

export async function showUpdatePrompt(info: UpdateInfo, input: NodeJS.ReadStream): Promise<void> {
  if (!info.hasUpdate) return;

  drawBox(info.latestVersion, info.currentVersion, true);

  const key = await readOneKey(input);

  if (key === 'u') {
    const width = 'Update complete! Please restart the app.'.length + 4;
    const border = '\u2500'.repeat(width);
    process.stdout.write(`  \u250c${border}\u2510\n`);
    process.stdout.write(`  \u2502  Installing pkacode-cli@${info.latestVersion}...  \u2502\n`);

    return new Promise((resolve) => {
      const child = spawn('npm', ['install', '-g', `pkacode-cli@${info.latestVersion}`], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      let stdout = '';
      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });
      child.stderr?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.on('close', (code) => {
        const width = 'Update complete! Please restart the app.'.length + 4;
        const border = '\u2500'.repeat(width);
        if (code === 0) {
          process.stdout.write(`  \u2502  Update complete! Please restart the app.  \u2502\n`);
        } else {
          process.stdout.write(`  \u2502  Update failed (code ${code})                  \u2502\n`);
        }
        process.stdout.write(`  \u2514${border}\u2518\n`);
        resolve();
      });
    });
  }

  // 'l' or any other key — dismiss, clear the box
  for (let i = 0; i < 4; i++) {
    readline.moveCursor(process.stdout, 0, -1);
    readline.clearLine(process.stdout, 0);
  }
}
