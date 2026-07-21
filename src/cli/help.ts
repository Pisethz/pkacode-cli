import chalk from 'chalk';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { printAllPkaCommands } from '../commands/catalog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

export function printBanner(): void {
  console.log(chalk.bold.cyan(`
  PKA — FREE AI CLI (Gemini · Groq · OpenRouter)
  ==============================================`));
}

export function printMainHelp(): void {
  printAllPkaCommands();
}
