import chalk from 'chalk';
import { loadConfig, saveConfig, PERMISSIONS_PATH } from '../config/store.js';
import { loadPermissionRules, savePermissionRules, getDefaultPermissionRules } from '../permissions/rules.js';
import { PERMISSION_MODES } from '../permissions/modes.js';
import { selectFromList } from '../ui/select.js';
import type { PermissionMode } from '../config/types.js';

export async function runPermissions(): Promise<'handled' | 'reload-provider'> {
  const config = loadConfig();
  const rules = loadPermissionRules();

  console.log(chalk.bold.cyan('\n  \u2501\u2501 PKA Permissions \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501'));
  console.log(chalk.dim(''));
  console.log(`  Mode:     ${chalk.yellow(config.permissionMode)}`);
  console.log(`  Tools:    ${chalk.yellow(config.enabledTools.join(', '))}`);
  console.log(`  Sandbox:  ${chalk.yellow(config.sandbox ? 'on' : 'off')}`);
  console.log('');
  console.log(chalk.green('  \u2713 Allow Rules:'));
  for (const r of rules.allow) {
    console.log(`    ${chalk.dim(r)}`);
  }
  console.log('');
  console.log(chalk.yellow('  ? Ask Rules:'));
  for (const r of rules.ask) {
    console.log(`    ${chalk.dim(r)}`);
  }
  console.log('');
  console.log(chalk.red('  \u2717 Deny Rules:'));
  for (const r of rules.deny) {
    console.log(`    ${chalk.dim(r)}`);
  }
  console.log('');
  console.log(chalk.dim(`  Rules file: ${PERMISSIONS_PATH}`));
  console.log('');

  // Interactive mode selector
  const selected = await selectFromList(
    'Select Permission Mode',
    PERMISSION_MODES.map(m => ({
      value: m,
      label: m,
      description: getModeDescription(m),
    })),
    { hint: '\u2191\u2193 navigate \u00b7 Enter to select \u00b7 Esc to cancel' }
  );

  if (selected && selected !== config.permissionMode) {
    config.permissionMode = selected as PermissionMode;
    saveConfig(config);
    console.log(chalk.green(`\n  \u2713 Permission mode changed to: ${chalk.bold(selected)}\n`));
    return 'reload-provider';
  }

  if (selected) {
    console.log(chalk.dim(`\n  Already using "${selected}". No change.\n`));
  } else {
    console.log(chalk.dim('\n  Mode selection cancelled.\n'));
  }

  return 'handled';
}

export function runPermissionsReset(): void {
  savePermissionRules(getDefaultPermissionRules());
  console.log(chalk.green('\n  \u2713 Permissions reset to defaults\n'));
}

function getModeDescription(mode: string): string {
  switch (mode) {
    case 'default':
      return 'Read auto \u00b7 Edit ask \u00b7 Bash ask';
    case 'auto-edit':
      return 'Read/Edit auto \u00b7 Bash ask';
    case 'plan':
      return 'Read only \u2014 no edits, no bash';
    case 'yolo':
      return 'Everything automatic \u2014 no prompts';
    default:
      return '';
  }
}
