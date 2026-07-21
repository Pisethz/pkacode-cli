import chalk from 'chalk';

/** Slash commands available inside the interactive chat session. */
export const SLASH_COMMANDS = [
  { cmd: '/pka', desc: 'Run any PKA CLI command (auth, models, provider, …)' },
  { cmd: '/help', desc: 'Show chat + PKA command reference' },
  { cmd: '/commands', desc: 'Show all PKA CLI commands' },
  { cmd: '/exit', desc: 'Exit the assistant' },
  { cmd: '/quit', desc: 'Exit the assistant' },
  { cmd: '/clear', desc: 'Clear conversation history' },
  { cmd: '/provider', desc: 'Show or switch FREE provider (gemini|groq|openrouter)' },
  { cmd: '/model', desc: 'Show or switch model' },
  { cmd: '/models', desc: 'List free models for active provider' },
  { cmd: '/session', desc: 'Show current session info' },
  { cmd: '/sessions', desc: 'List saved sessions' },
  { cmd: '/new', desc: 'Start a new chat session' },
  { cmd: '/resume', desc: 'Resume a saved session (interactive picker)' },
  { cmd: '/auth', desc: 'FREE login — Gemini / Groq / OpenRouter' },
  { cmd: '/tokens', desc: 'Show token usage this session' },
  { cmd: '/config', desc: 'Show current configuration' },
  { cmd: '/permissions', desc: 'Show permission rules & mode' },
  { cmd: '/sandbox', desc: 'Show or set sandbox preference on|off' },
  { cmd: '/reset', desc: 'Reset configuration to defaults' },
  { cmd: '/multiline', desc: 'Enter multi-line input mode' },
] as const;

export type SlashCommand = (typeof SLASH_COMMANDS)[number]['cmd'];

export const SLASH_COMMAND_NAMES = SLASH_COMMANDS.map(c => c.cmd);

export const SLASH_COMMAND_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  SLASH_COMMANDS.map(c => [c.cmd, c.desc])
);

/** Full external CLI reference — FREE-only. */
export function printAllPkaCommands(): void {
  console.log(chalk.bold.cyan('\n  PKA — FREE AI CLI'));
  console.log(chalk.bold.green('  Providers: Gemini · Groq · OpenRouter  (no paid Claude / ChatGPT / DeepSeek)'));
  console.log(chalk.bold.cyan('  ====================================================================\n'));

  console.log(chalk.bold('===================================================='));
  console.log(chalk.bold('1. CORE COMMANDS'));
  console.log(chalk.bold('===================================================='));
  console.log(`
  pka                          Start interactive session
  pka "prompt"                 Start with an initial prompt
  pka -p "prompt"              Headless/print mode — answer then exit
  pka chat                     Explicit chat mode
  pka serve                    Start web chat server & open in browser
  pka config                   View FREE provider keys & defaults
  pka models list              List free models
  pka models list --provider gemini
  pka models list --provider groq
  pka models list --provider openrouter
  pka provider set <name>      Switch FREE provider
  pka model set <name>         Switch free model
  pka resume [session]         Resume a past conversation
  pka sessions list            List saved sessions
  pka sessions clear           Clear saved sessions
`);

  console.log(chalk.bold('===================================================='));
  console.log(chalk.bold('2. FREE AUTH & MODELS'));
  console.log(chalk.bold('===================================================='));
  console.log(`
  pka auth login                   Browser login (Gemini / Groq / OpenRouter)
  pka auth status                  Show FREE auth status
  pka auth logout <provider>       Remove stored credentials
  pka models refresh               Re-pull free model list
  pka models pin <alias> <model>   e.g. pka models pin fast gemini-2.0-flash
`);
  console.log(chalk.dim('  OpenRouter always forces :free / openrouter/free models.'));
  console.log('');

  console.log(chalk.bold('===================================================='));
  console.log(chalk.bold('3. PERMISSION LAYER'));
  console.log(chalk.bold('===================================================='));
  console.log(`
  pka permissions                      View allow / ask / deny rules
  pka --permission-mode <mode>         default | auto-edit | plan | yolo
  pka --add-dir <path>                 Grant file access to a directory
  pka --tools <list>                   Restrict tools: bash,fs,net
  pka sandbox on|off                   Sandbox preference (stub)
  pka --dangerously-skip-permissions   Power-user bypass (off by default)
`);

  console.log(chalk.bold('===================================================='));
  console.log(chalk.bold('4. IN-CHAT COMMANDS'));
  console.log(chalk.bold('===================================================='));
  console.log(`
  Type / for the popup. All CLI commands also work as:

  /pka auth login              Pick FREE provider → browser login → model
  /pka auth status
  /pka models list --provider gemini
  /pka provider set gemini|groq|openrouter
  /pka model set <name>
  /pka sessions list
  /pka help

  Or use short forms: /auth  /provider  /model  /models  /sessions ...
`);

  for (const c of SLASH_COMMANDS) {
    console.log(`  ${chalk.green(c.cmd.padEnd(16))} ${chalk.dim(c.desc)}`);
  }

  console.log('');
  console.log(chalk.green('  PKA is FREE-only. Claude / ChatGPT / DeepSeek are not available.'));
  console.log(chalk.dim('  Config dir: ~/.config/pka'));
  console.log('');
}
