import chalk from 'chalk';
import { runAuthLogin, runAuthLogout, runAuthStatus } from './auth.js';
import { runConfigView, runConfigInit, runConfigSet } from './config.js';
import {
  refreshAllModels,
  loadModelsCache,
  pinModel,
  setProvider,
  setModel,
  fetchModelsForProvider,
} from './models.js';
import { runPermissions, runPermissionsReset } from './permissions.js';
import { runSandbox } from './sandbox.js';
import { runSessionsList, runSessionsClear, runResumeInfo } from './sessions.js';
import { printAllPkaCommands } from './catalog.js';
import { PROVIDER_NAMES } from '../config/types.js';
import { isValidProvider } from '../auth/credentials.js';
import type { ProviderName } from '../config/types.js';
import { runModelPicker, runAuthLoginWizard } from '../auth/wizard.js';

export type DispatchResult =
  | 'exit'
  | 'reload-provider'
  | 'handled'
  | { resumeSessionId: string };

/**
 * Dispatch `/pka ...` commands from inside chat.
 * Examples:
 *   /pka auth login
 *   /pka models list --provider gemini
 *   /pka provider set gemini
 */
export async function dispatchPkaCommand(rawArgs: string[]): Promise<DispatchResult> {
  let args = [...rawArgs];
  if (args[0]?.toLowerCase() === '/pka' || args[0]?.toLowerCase() === 'pka') {
    args = args.slice(1);
  }
  if (args.length === 0) {
    printAllPkaCommands();
    return 'handled';
  }

  const cmd = args[0].toLowerCase();
  const rest = args.slice(1);

  switch (cmd) {
    case 'help':
    case 'commands':
      printAllPkaCommands();
      return 'handled';

    case 'chat':
      console.log(chalk.dim('\n  Already in interactive chat.\n'));
      return 'handled';

    case 'config':
      if (rest[0] === 'init') runConfigInit();
      else if (rest[0] === 'set' && rest[1] && rest[2]) runConfigSet(rest[1], rest.slice(2).join(' '));
      else runConfigView();
      return 'handled';

    case 'auth':
      if (rest[0] === 'login' || !rest[0]) {
        await runAuthLogin(rest[0] === 'login' ? rest[1] : rest[0], rest[0] === 'login' ? rest[2] : rest[1]);
        return 'reload-provider';
      }
      if (rest[0] === 'logout') {
        await runAuthLogout(rest[1]);
        return 'handled';
      }
      if (rest[0] === 'status') {
        runAuthStatus();
        return 'handled';
      }
      console.log(chalk.red('  Usage: /pka auth login|logout|status'));
      return 'handled';

    case 'models': {
      if (rest[0] === 'refresh') {
        const filter = rest.includes('--provider')
          ? rest[rest.indexOf('--provider') + 1]
          : rest[1];
        const p = filter && isValidProvider(filter) ? (filter as ProviderName) : undefined;
        console.log(chalk.cyan('\n  Refreshing models...\n'));
        await refreshAllModels(p);
        console.log(chalk.green('\n  ✓ Done\n'));
        return 'handled';
      }
      if (rest[0] === 'pin' && rest[1] && rest[2]) {
        pinModel(rest[1], rest[2]);
        console.log(chalk.green(`\n  ✓ Pinned ${rest[1]} → ${rest[2]}\n`));
        return 'handled';
      }
      if (rest[0] === 'cache') {
        const cache = loadModelsCache();
        console.log(chalk.cyan(`\n  Models cache (${cache.updatedAt || 'never'})\n`));
        for (const [p, list] of Object.entries(cache.models)) {
          console.log(chalk.bold(`  ${p}`));
          for (const m of list || []) console.log(`    • ${m}`);
          console.log('');
        }
        return 'handled';
      }
      if (rest[0] === 'pick' || rest[0] === 'select') {
        await runModelPicker();
        return 'reload-provider';
      }
      // list (default)
      const providerFlagIdx = rest.indexOf('--provider');
      let filter: ProviderName | undefined;
      if (providerFlagIdx >= 0 && rest[providerFlagIdx + 1] && isValidProvider(rest[providerFlagIdx + 1])) {
        filter = rest[providerFlagIdx + 1] as ProviderName;
      } else if (rest[0] === 'list' && rest[1] && isValidProvider(rest[1])) {
        filter = rest[1] as ProviderName;
      } else if (rest[0] && rest[0] !== 'list' && isValidProvider(rest[0])) {
        filter = rest[0] as ProviderName;
      }
      const providers = filter ? [filter] : PROVIDER_NAMES;
      console.log(chalk.bold.cyan('\n  Available Models\n'));
      for (const p of providers) {
        const models = await fetchModelsForProvider(p);
        console.log(chalk.bold(`  ${p}`));
        if (!models.length) console.log(chalk.dim('    (none — check auth / network)'));
        else for (const m of models) console.log(`    • ${m}`);
        console.log('');
      }
      return 'handled';
    }

    case 'provider':
      if (rest[0] === 'set' && rest[1]) {
        if (!isValidProvider(rest[1])) {
          console.log(chalk.red(`  Unknown provider. Use: ${PROVIDER_NAMES.join(', ')}`));
          return 'handled';
        }
        setProvider(rest[1] as ProviderName);
        console.log(chalk.green(`\n  ✓ Provider set to ${rest[1]}\n`));
        return 'reload-provider';
      }
      await runAuthLoginWizard();
      return 'reload-provider';

    case 'model':
      if (rest[0] === 'set' && rest[1]) {
        setModel(rest.slice(1).join(' '));
        console.log(chalk.green(`\n  ✓ Model set\n`));
        return 'reload-provider';
      }
      await runModelPicker();
      return 'reload-provider';

    case 'sessions':
      if (rest[0] === 'clear') runSessionsClear();
      else runSessionsList();
      return 'handled';

    case 'resume': {
      const session = runResumeInfo(rest[0]);
      if (session) {
        return { resumeSessionId: session.id };
      }
      return 'handled';
    }

    case 'permissions':
      if (rest[0] === 'reset') {
        runPermissionsReset();
        return 'handled';
      }
      return await runPermissions();

    case 'sandbox':
      runSandbox(rest[0]);
      return 'handled';

    case 'exit':
    case 'quit':
      return 'exit';

    default:
      console.log(chalk.yellow(`\n  Unknown: /pka ${cmd}`));
      console.log(chalk.dim('  Type /pka help for the full command list.\n'));
      return 'handled';
  }
}
