import chalk from 'chalk';
import type { ProviderName } from '../config/types.js';
import { PROVIDER_NAMES } from '../config/types.js';
import { isValidProvider, logoutProvider, printAuthStatus } from '../auth/credentials.js';
import { runAuthLoginWizard } from '../auth/wizard.js';

/**
 * FREE-only login wizard: Gemini / Groq / OpenRouter.
 */
export async function runAuthLogin(providerArg?: string, key?: string): Promise<void> {
  await runAuthLoginWizard(providerArg, key);
}

export async function runAuthLogout(providerArg?: string): Promise<void> {
  if (!providerArg || !isValidProvider(providerArg)) {
    console.log(chalk.red(`  Usage: pka auth logout <${PROVIDER_NAMES.join('|')}>`));
    return;
  }
  logoutProvider(providerArg as ProviderName);
  console.log(chalk.green(`\n  ✓ Logged out of ${providerArg}\n`));
}

export function runAuthStatus(): void {
  printAuthStatus();
}
