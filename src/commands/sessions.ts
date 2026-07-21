import chalk from 'chalk';
import { listSessions, clearSessions, loadSession } from '../sessions/store.js';

export function runSessionsList(): void {
  const sessions = listSessions();
  if (sessions.length === 0) {
    console.log(chalk.dim('\n  No saved sessions.\n'));
    return;
  }

  console.log(chalk.bold.cyan('\n  Saved Sessions\n'));
  for (const s of sessions) {
    console.log(`  ${chalk.green(s.id)}`);
    console.log(chalk.dim(`    ${s.provider}/${s.model}  ·  ${s.updatedAt}`));
    console.log(chalk.dim(`    ${s.preview}`));
    console.log('');
  }
}

export function runSessionsClear(): void {
  const n = clearSessions();
  console.log(chalk.green(`\n  ✓ Cleared ${n} session(s)\n`));
}

export function runResumeInfo(id?: string): ReturnType<typeof loadSession> {
  if (!id) {
    const sessions = listSessions();
    if (sessions.length === 0) {
      console.log(chalk.dim('\n  No sessions to resume. Start with: pka\n'));
      return null;
    }
    const latest = sessions[0];
    console.log(chalk.cyan(`\n  Resuming latest session: ${latest.id}\n`));
    return loadSession(latest.id);
  }

  const session = loadSession(id);
  if (!session) {
    console.log(chalk.red(`\n  Session not found: ${id}\n`));
    console.log(chalk.dim('  Run: pka sessions list\n'));
    return null;
  }
  console.log(chalk.cyan(`\n  Resuming session: ${session.id}\n`));
  return session;
}
