#!/usr/bin/env node

import chalk from 'chalk';
import { runCLI } from './cli/program.js';

async function main() {
  try {
    await runCLI(process.argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`\n  PKA error: ${message}\n`));
    process.exit(1);
  }
}

main();
