import chalk from 'chalk';
import { spawn } from 'node:child_process';
import { exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { platform } from 'node:os';

const PORT = 3721;
const CHAT_URL = `http://localhost:${PORT}/chat`;

function findServerDir(): string | null {
  const candidates = [
    join(process.env.APPDATA || '', 'pka', 'web-server'),
    join(process.env.HOME || process.env.USERPROFILE || '', '.config', 'pka', 'web-server'),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'server', 'index.js'))) return join(dir, 'server');
  }
  const localPaths = [
    join('C:\\', 'Users', process.env.USERNAME || '', 'Desktop', 'pkacode', 'server'),
  ];
  for (const dir of localPaths) {
    if (existsSync(join(dir, 'index.js'))) return dir;
  }
  return null;
}

function openBrowser(url: string): void {
  const cmd =
    platform() === 'win32'
      ? `start "" "${url}"`
      : platform() === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;

  exec(cmd, (err) => {
    if (err) {
      console.log(chalk.yellow(`\n  Could not auto-open browser. Open manually:\n  ${chalk.cyan(url)}\n`));
    }
  });
}

export async function runWeb(): Promise<void> {
  console.log(chalk.cyan('\n  PKA CODE Web Chat\n'));

  const serverDir = findServerDir();
  if (!serverDir) {
    console.log(chalk.red('  Server not found.'));
    console.log(chalk.dim('  Install pkacode or place the server folder correctly.\n'));
    return;
  }

  console.log(chalk.dim(`  Server dir: ${serverDir}`));
  console.log(chalk.dim(`  Starting server on port ${PORT}...\n`));

  const server = spawn(process.execPath, [join(serverDir, 'index.js')], {
    cwd: serverDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT) },
  });

  let serverReady = false;

  server.stdout?.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line) console.log(chalk.dim('  [server] ') + line);
    if (line.includes('listening') || line.includes('Server ready') || line.includes('http://')) {
      if (!serverReady) {
        serverReady = true;
        console.log(chalk.green('  Server ready! Opening browser...\n'));
        openBrowser(CHAT_URL);
        console.log(chalk.dim(`  Chat URL: ${CHAT_URL}\n`));
        console.log(chalk.dim('  Press Ctrl+C to stop the server.\n'));
      }
    }
  });

  server.stderr?.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line) console.log(chalk.dim('  [server] ') + line);
  });

  server.on('error', (err) => {
    console.log(chalk.red(`  Failed to start server: ${err.message}`));
  });

  server.on('close', (code) => {
    console.log(chalk.dim(`\n  Server stopped (code ${code}).`));
  });

  process.on('SIGINT', () => { server.kill(); process.exit(0); });
  process.on('SIGTERM', () => { server.kill(); process.exit(0); });

  setTimeout(() => {
    if (!serverReady) {
      serverReady = true;
      console.log(chalk.green('  Server started! Opening browser...\n'));
      openBrowser(CHAT_URL);
      console.log(chalk.dim(`  Chat URL: ${CHAT_URL}\n`));
      console.log(chalk.dim('  Press Ctrl+C to stop the server.\n'));
    }
  }, 3000);
}
