import chalk from 'chalk';
import { loadConfig, saveConfig } from '../config/store.js';

export function runSandbox(state?: string): void {
  const config = loadConfig();

  if (!state) {
    console.log(chalk.cyan(`\n  Sandbox: ${config.sandbox ? 'on' : 'off'}`));
    console.log(chalk.yellow('  Note: sandbox preference is saved but not enforced yet (no Docker/VM in this version).\n'));
    return;
  }

  if (state !== 'on' && state !== 'off') {
    console.log(chalk.red('  Usage: pka sandbox on|off'));
    return;
  }

  config.sandbox = state === 'on';
  saveConfig(config);
  console.log(chalk.green(`\n  ✓ Sandbox set to ${state}`));
  console.log(chalk.yellow('  Note: not enforced yet — preference only for future container/VM runs.\n'));
}
