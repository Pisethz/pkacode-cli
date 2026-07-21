/**
 * Legacy arg parser kept for compatibility with older scripts.
 */
export interface CLIOptions {
  prompt?: string;
  help?: boolean;
  version?: boolean;
  init?: boolean;
  config?: boolean;
  listModels?: boolean;
  model?: string;
  provider?: string;
  temperature?: number;
  'max-tokens'?: number;
}

export function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--version':
      case '-v':
        options.version = true;
        break;
      case '--init':
        options.init = true;
        break;
      case '--config':
        options.config = true;
        break;
      case '--models':
        options.listModels = true;
        break;
      case '--model':
        options.model = args[++i];
        break;
      case '--provider':
        options.provider = args[++i];
        break;
      case '--temperature':
        options.temperature = parseFloat(args[++i]);
        break;
      case '--max-tokens':
        options['max-tokens'] = parseInt(args[++i], 10);
        break;
      default:
        if (!arg.startsWith('--')) {
          options.prompt = options.prompt ? options.prompt + ' ' + arg : arg;
        }
        break;
    }
  }
  return options;
}

export function printCLIHelp(): void {
  import('./help.js').then(m => m.printMainHelp());
}
