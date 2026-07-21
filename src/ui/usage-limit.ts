import chalk from 'chalk';

export interface UsageLimitInfo {
  isLimit: boolean;
  message: string;
  resetAt?: Date;
  retryAfterSeconds?: number;
  suggestChangeModel: boolean;
  /** True for 402 / insufficient balance (not a time-based rate limit) */
  isPaymentRequired?: boolean;
}

/**
 * Parse provider rate-limit / subscription usage errors into a friendly CLI message.
 */
export function parseUsageLimitError(
  error: unknown,
  headers?: Headers | Record<string, string> | null
): UsageLimitInfo | null {
  const text = error instanceof Error ? error.message : String(error);
  const lower = text.toLowerCase();

  const looksLikeLimit =
    lower.includes('rate_limit') ||
    lower.includes('rate limit') ||
    lower.includes('usage limit') ||
    lower.includes('quota') ||
    lower.includes('429') ||
    lower.includes('402') ||
    lower.includes('payment required') ||
    lower.includes('insufficient balance') ||
    lower.includes('insufficient_quota') ||
    lower.includes('billing') ||
    lower.includes('too many requests') ||
    lower.includes('exhausted') ||
    lower.includes("you've hit") ||
    lower.includes('reached your');

  const isBalance =
    lower.includes('402') ||
    lower.includes('payment required') ||
    lower.includes('insufficient balance') ||
    lower.includes('insufficient_quota') ||
    lower.includes('billing');

  if (!looksLikeLimit) return null;

  let retryAfterSeconds: number | undefined;
  let resetAt: Date | undefined;

  const headerGet = (name: string): string | null => {
    if (!headers) return null;
    if (typeof (headers as Headers).get === 'function') {
      return (headers as Headers).get(name);
    }
    const rec = headers as Record<string, string>;
    const key = Object.keys(rec).find(k => k.toLowerCase() === name.toLowerCase());
    return key ? rec[key] : null;
  };

  const retryAfter = headerGet('retry-after');
  if (retryAfter) {
    const secs = parseInt(retryAfter, 10);
    if (!Number.isNaN(secs)) {
      retryAfterSeconds = secs;
      resetAt = new Date(Date.now() + secs * 1000);
    } else {
      const asDate = new Date(retryAfter);
      if (!Number.isNaN(asDate.getTime())) resetAt = asDate;
    }
  }

  // Anthropic-style reset headers (ISO or unix)
  for (const h of [
    'anthropic-ratelimit-requests-reset',
    'anthropic-ratelimit-tokens-reset',
    'x-ratelimit-reset-requests',
    'x-ratelimit-reset-tokens',
  ]) {
    const v = headerGet(h);
    if (!v) continue;
    const asNum = Number(v);
    if (!Number.isNaN(asNum) && asNum > 1_000_000_000) {
      resetAt = new Date(asNum * (asNum < 1e12 ? 1000 : 1));
      break;
    }
    const asDate = new Date(v);
    if (!Number.isNaN(asDate.getTime())) {
      resetAt = asDate;
      break;
    }
  }

  // Parse "try again in Xs" / "resets at ..." from body
  if (!resetAt) {
    const mSecs = text.match(/try again in\s+(\d+)\s*(second|minute|hour|min|sec|hr)/i);
    if (mSecs) {
      const n = parseInt(mSecs[1], 10);
      const unit = mSecs[2].toLowerCase();
      const mult = unit.startsWith('hour') || unit.startsWith('hr') ? 3600
        : unit.startsWith('min') ? 60 : 1;
      retryAfterSeconds = n * mult;
      resetAt = new Date(Date.now() + retryAfterSeconds * 1000);
    }
  }

  if (!resetAt && !retryAfterSeconds) {
    // Default soft guess: 1 hour for subscription usage caps
    resetAt = new Date(Date.now() + 60 * 60 * 1000);
    retryAfterSeconds = 3600;
  }

  return {
    isLimit: true,
    message: text,
    resetAt: isBalance ? undefined : resetAt,
    retryAfterSeconds: isBalance ? undefined : retryAfterSeconds,
    suggestChangeModel: true,
    isPaymentRequired: isBalance,
  };
}

export function formatUsageLimitMessage(info: UsageLimitInfo, currentModel?: string): string {
  if (info.isPaymentRequired) {
    const lines = [
      '',
      chalk.bold.yellow('  No credits / balance left on this provider.'),
      chalk.yellow('  Switch to a FREE provider (no payment):'),
      chalk.cyan('    /pka auth login'),
      chalk.green('      → pick Gemini, Groq, or OpenRouter'),
      chalk.dim('  Or jump now if already logged in:'),
      chalk.cyan('    /pka provider set gemini'),
      chalk.cyan('    /pka provider set groq'),
      chalk.cyan('    /pka provider set openrouter'),
    ];
    if (currentModel) {
      lines.push(chalk.dim(`  Was using: ${currentModel}`));
    }
    lines.push('');
    return lines.join('\n');
  }

  const when = info.resetAt
    ? info.resetAt.toLocaleString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : 'later';

  const lines = [
    '',
    chalk.bold.yellow("  You've reached your usage limit."),
    chalk.yellow(`  Please start again at ${chalk.bold(when)}.`),
  ];

  if (currentModel) {
    lines.push(chalk.dim(`  Current model: ${currentModel}`));
  }

  lines.push(
    chalk.dim('  Or switch model now:'),
    chalk.cyan('    /models pick'),
    chalk.cyan('    /pka model set <name>'),
    chalk.cyan('    /provider   (pick another AI)'),
    ''
  );

  return lines.join('\n');
}

export function printUsageLimit(error: unknown, currentModel?: string, headers?: Headers | null): boolean {
  const hdrs =
    headers ||
    (error && typeof error === 'object' && 'headers' in error
      ? ((error as { headers?: Headers | null }).headers ?? null)
      : null);
  const info = parseUsageLimitError(error, hdrs);
  if (!info) return false;
  console.log(formatUsageLimitMessage(info, currentModel));
  return true;
}
