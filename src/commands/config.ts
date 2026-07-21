import chalk from 'chalk';
import { loadConfig, saveConfig, printConfig, getDefaultConfig, getConfigPath } from '../config/store.js';
import type { PermissionMode, ToolCategory } from '../config/types.js';
import { PERMISSION_MODES } from '../permissions/modes.js';

export function runConfigView(): void {
  printConfig(loadConfig());
}

export function runConfigInit(): void {
  const config = getDefaultConfig();
  saveConfig(config);
  console.log(chalk.green('\n  ✓ Config created at:'));
  console.log(chalk.dim(`    ${getConfigPath()}`));
  printConfig(config);
}

export function runConfigSet(key?: string, value?: string): void {
  if (!key || value === undefined) {
    console.log(chalk.dim('  Usage: pka config set <key> <value>'));
    console.log(chalk.dim('  Keys: provider, model, temperature, maxTokens, permissionMode, sandbox'));
    runConfigView();
    return;
  }

  const config = loadConfig();
  switch (key) {
    case 'provider':
      config.provider = value as typeof config.provider;
      break;
    case 'model':
      config.model = value;
      break;
    case 'temperature':
      config.temperature = parseFloat(value);
      break;
    case 'maxTokens':
    case 'max-tokens':
      config.maxTokens = parseInt(value, 10);
      break;
    case 'permissionMode':
    case 'permission-mode':
      if (!PERMISSION_MODES.includes(value as PermissionMode)) {
        console.log(chalk.red(`  Invalid mode. Use: ${PERMISSION_MODES.join(', ')}`));
        return;
      }
      config.permissionMode = value as PermissionMode;
      break;
    case 'sandbox':
      config.sandbox = value === 'on' || value === 'true' || value === '1';
      break;
    case 'enabledTools':
    case 'tools':
      config.enabledTools = value.split(',').map(s => s.trim()) as ToolCategory[];
      break;
    default:
      console.log(chalk.red(`  Unknown key: ${key}`));
      return;
  }
  saveConfig(config);
  console.log(chalk.green(`\n  ✓ Set ${key} = ${value}\n`));
}
