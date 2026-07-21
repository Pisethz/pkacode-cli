import { Command } from 'commander';
import chalk from 'chalk';
import { resolve } from 'node:path';
import { printMainHelp, getVersion } from './help.js';
import { runChat, runPrint } from '../commands/chat.js';
import { runAuthLogin, runAuthLogout, runAuthStatus } from '../commands/auth.js';
import { runConfigView, runConfigInit, runConfigSet } from '../commands/config.js';
import {
  refreshAllModels,
  loadModelsCache,
  pinModel,
  setProvider,
  setModel,
  fetchModelsForProvider,
} from '../commands/models.js';
import { runPermissions, runPermissionsReset } from '../commands/permissions.js';
import { runSandbox } from '../commands/sandbox.js';
import { runSessionsList, runSessionsClear, runResumeInfo } from '../commands/sessions.js';
import { printAllPkaCommands } from '../commands/catalog.js';
import type { ProviderName, PermissionMode, ToolCategory } from '../config/types.js';
import { PROVIDER_NAMES } from '../config/types.js';
import { PERMISSION_MODES } from '../permissions/modes.js';
import type { RuntimePermissions } from '../permissions/engine.js';
import { isValidProvider } from '../auth/credentials.js';

export interface GlobalFlags {
  permissionMode?: PermissionMode;
  addDir: string[];
  tools?: string;
  dangerouslySkipPermissions?: boolean;
  print?: string | true;
}

function buildRuntime(flags: GlobalFlags): Partial<RuntimePermissions> {
  const runtime: Partial<RuntimePermissions> = {
    dangerouslySkipPermissions: Boolean(flags.dangerouslySkipPermissions),
    workspaceDirs: flags.addDir.map(d => resolve(d)),
  };
  if (flags.permissionMode) {
    runtime.permissionMode = flags.permissionMode;
  }
  if (flags.tools) {
    runtime.enabledTools = flags.tools.split(',').map(s => s.trim()) as ToolCategory[];
  }
  return runtime;
}

export function createProgram(): Command {
  const program = new Command();

  program
    .name('pka')
    .description('PKA — FREE-only AI CLI (Gemini · Groq · OpenRouter)')
    .version(getVersion(), '-v, --version')
    .option('-p, --print [prompt]', 'Headless print mode — answer then exit')
    .option('--permission-mode <mode>', `Permission mode: ${PERMISSION_MODES.join('|')}`)
    .option('--add-dir <path>', 'Grant file access to a directory', (val, prev: string[]) => {
      prev.push(val);
      return prev;
    }, [] as string[])
    .option('--tools <list>', 'Enabled tool categories: bash,fs,net')
    .option('--dangerously-skip-permissions', 'Bypass permission checks')
    .argument('[prompt...]', 'Optional initial prompt')
    .action(async (promptParts: string[], opts) => {
      const flags = opts as GlobalFlags;
      const runtime = buildRuntime({
        ...flags,
        addDir: flags.addDir || [],
      });

      // Validate permission mode if provided
      if (flags.permissionMode && !PERMISSION_MODES.includes(flags.permissionMode)) {
        console.log(chalk.red(`Invalid --permission-mode. Use: ${PERMISSION_MODES.join(', ')}`));
        process.exitCode = 1;
        return;
      }

      const joined = promptParts?.join(' ').trim();
      const printOpt = flags.print;

      if (printOpt !== undefined) {
        const printPrompt = typeof printOpt === 'string' && printOpt.length
          ? printOpt
          : joined;
        await runPrint(printPrompt || '', runtime);
        return;
      }

      if (joined) {
        await runChat({ prompt: joined, runtime });
        return;
      }

      await runChat({ runtime });
    });

  program
    .command('chat')
    .description('Start interactive chat mode')
    .argument('[prompt...]', 'Optional initial prompt')
    .action(async (promptParts: string[]) => {
      const opts = program.opts() as GlobalFlags;
      const runtime = buildRuntime({ ...opts, addDir: opts.addDir || [] });
      const prompt = promptParts?.join(' ').trim();
      await runChat({ prompt: prompt || undefined, runtime });
    });

  // config
  const configCmd = program.command('config').description('View or edit configuration');
  configCmd.action(() => runConfigView());
  configCmd.command('init').description('Create default config').action(() => runConfigInit());
  configCmd
    .command('set')
    .argument('<key>')
    .argument('<value>')
    .description('Set a config value')
    .action((key: string, value: string) => runConfigSet(key, value));

  // auth
  const authCmd = program.command('auth').description('Manage provider credentials');
  authCmd
    .command('login')
    .argument('<provider>')
    .argument('[key]')
    .description('Set API key for a provider')
    .action(async (provider: string, key?: string) => runAuthLogin(provider, key));
  authCmd
    .command('logout')
    .argument('<provider>')
    .description('Remove API key for a provider')
    .action(async (provider: string) => runAuthLogout(provider));
  authCmd.command('status').description('Show auth status').action(() => runAuthStatus());

  // models
  const modelsCmd = program.command('models').description('List and manage models');
  modelsCmd
    .command('list')
    .option('--provider <name>', 'Filter by provider')
    .description('List available models (live from APIs)')
    .action(async (opts: { provider?: string }) => {
      let providers: ProviderName[] = PROVIDER_NAMES;
      if (opts.provider) {
        if (!isValidProvider(opts.provider)) {
          console.log(chalk.red(`Unknown provider: ${opts.provider}`));
          return;
        }
        providers = [opts.provider];
      }

      console.log(chalk.bold.cyan('\n  Available Models\n'));
      for (const p of providers) {
        const models = await fetchModelsForProvider(p);
        console.log(chalk.bold(`  ${p}`));
        if (models.length === 0) {
          console.log(chalk.dim('    (none — check auth / network)'));
        } else {
          for (const m of models) console.log(`    • ${m}`);
        }
        console.log('');
      }
    });

  modelsCmd
    .command('refresh')
    .option('--provider <name>', 'Refresh one provider only')
    .description('Re-pull latest model lists from provider APIs')
    .action(async (opts: { provider?: string }) => {
      const filter = opts.provider && isValidProvider(opts.provider) ? opts.provider : undefined;
      console.log(chalk.cyan('\n  Refreshing models...\n'));
      const cache = await refreshAllModels(filter);
      console.log(chalk.green(`\n  ✓ Cache updated at ${cache.updatedAt}\n`));
    });

  modelsCmd
    .command('pin')
    .argument('<alias>')
    .argument('<model>')
    .description('Pin an alias to a model id')
    .action((alias: string, model: string) => {
      pinModel(alias, model);
      console.log(chalk.green(`\n  ✓ Pinned ${alias} → ${model}\n`));
    });

  modelsCmd
    .command('cache')
    .description('Show cached model list')
    .action(() => {
      const cache = loadModelsCache();
      console.log(chalk.cyan(`\n  Models cache (updated: ${cache.updatedAt || 'never'})\n`));
      for (const [p, list] of Object.entries(cache.models)) {
        console.log(chalk.bold(`  ${p}`));
        for (const m of list || []) console.log(`    • ${m}`);
        console.log('');
      }
    });

  // provider set
  const providerCmd = program.command('provider').description('Manage active provider');
  providerCmd
    .command('set')
    .argument('<name>')
    .description('Switch active provider')
    .action((name: string) => {
      if (!isValidProvider(name)) {
        console.log(chalk.red(`Unknown provider. Use: ${PROVIDER_NAMES.join(', ')}`));
        return;
      }
      setProvider(name);
      console.log(chalk.green(`\n  ✓ Provider set to ${name}\n`));
    });

  // model set
  const modelCmd = program.command('model').description('Manage active model');
  modelCmd
    .command('set')
    .argument('<name>')
    .description('Switch active model (resolves pins)')
    .action((name: string) => {
      setModel(name);
      console.log(chalk.green(`\n  ✓ Model set to ${name}\n`));
    });

  // sessions
  const sessionsCmd = program.command('sessions').description('Manage saved sessions');
  sessionsCmd.command('list').description('List saved sessions').action(() => runSessionsList());
  sessionsCmd.command('clear').description('Clear saved sessions').action(() => runSessionsClear());

  program
    .command('resume')
    .argument('[session]')
    .description('Resume a past conversation')
    .action(async (sessionId?: string) => {
      const opts = program.opts() as GlobalFlags;
      const runtime = buildRuntime({ ...opts, addDir: opts.addDir || [] });
      const session = runResumeInfo(sessionId);
      if (!session) return;
      await runChat({ resumeSession: session, runtime });
    });

  // permissions
  const permCmd = program.command('permissions').description('View permission rules');
  permCmd.action(async () => { await runPermissions(); });
  permCmd.command('reset').description('Reset permission rules').action(() => runPermissionsReset());

  // sandbox
  program
    .command('sandbox')
    .argument('[state]', 'on or off')
    .description('Toggle sandbox preference (not enforced yet)')
    .action((state?: string) => runSandbox(state));

  program
    .command('commands')
    .description('Show the full PKA command & architecture reference')
    .action(() => printAllPkaCommands());

  // help override
  program.helpOption('-h, --help', 'Show help');
  program.on('--help', () => {
    printMainHelp();
  });

  return program;
}

export async function runCLI(argv = process.argv): Promise<void> {
  const program = createProgram();

  // Show custom help when bare --help / -h with no subcommand nuance
  if (argv.includes('--help') || argv.includes('-h')) {
    // Let commander handle per-command help; for root-only help print banner
    const withoutNode = argv.slice(2);
    if (withoutNode.length === 1 && (withoutNode[0] === '--help' || withoutNode[0] === '-h')) {
      printMainHelp();
      return;
    }
  }

  await program.parseAsync(argv);
}
