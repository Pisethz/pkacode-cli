import readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import chalk from 'chalk';

export interface SelectItem {
  value: string;
  label: string;
  description?: string;
}

/**
 * Interactive arrow-key list picker (TTY). Falls back to numbered prompt if not TTY.
 */
export async function selectFromList(
  title: string,
  items: SelectItem[],
  opts?: { hint?: string }
): Promise<string | null> {
  if (items.length === 0) return null;

  if (!input.isTTY || !output.isTTY) {
    return selectNumbered(title, items);
  }

  return new Promise((resolve) => {
    let index = 0;
    let drawn = 0;

    const hint = opts?.hint || '↑↓ navigate · Enter select · Esc cancel';

    const render = () => {
      if (drawn > 0) {
        readline.moveCursor(output, 0, -(drawn - 1));
        for (let i = 0; i < drawn; i++) {
          readline.cursorTo(output, 0);
          readline.clearLine(output, 0);
          if (i < drawn - 1) readline.moveCursor(output, 0, 1);
        }
        if (drawn > 1) readline.moveCursor(output, 0, -(drawn - 1));
      }

      const lines: string[] = [];
      lines.push(chalk.bold.cyan(`  ${title}`));
      lines.push(chalk.dim(`  ${hint}`));
      lines.push('');
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const selected = i === index;
        const marker = selected ? chalk.cyan('›') : ' ';
        const label = selected ? chalk.bold.cyan(item.label) : chalk.white(item.label);
        const desc = item.description ? chalk.dim(`  — ${item.description}`) : '';
        lines.push(`  ${marker} ${label}${desc}`);
      }

      for (let i = 0; i < lines.length; i++) {
        readline.cursorTo(output, 0);
        output.write(lines[i]);
        if (i < lines.length - 1) output.write('\n');
      }
      drawn = lines.length;
    };

    const cleanup = () => {
      input.setRawMode(false);
      input.removeListener('keypress', onKey);
      input.pause();
      output.write('\n');
    };

    const onKey = (_str: string | undefined, key: readline.Key) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        resolve(null);
        return;
      }
      if (key.name === 'escape') {
        cleanup();
        resolve(null);
        return;
      }
      if (key.name === 'up') {
        index = (index - 1 + items.length) % items.length;
        render();
        return;
      }
      if (key.name === 'down') {
        index = (index + 1) % items.length;
        render();
        return;
      }
      if (key.name === 'return') {
        const value = items[index].value;
        cleanup();
        resolve(value);
      }
    };

    readline.emitKeypressEvents(input);
    input.setRawMode(true);
    input.resume();
    input.on('keypress', onKey);
    output.write('\n');
    render();
  });
}

async function selectNumbered(title: string, items: SelectItem[]): Promise<string | null> {
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input, output });
  try {
    console.log(chalk.bold.cyan(`\n  ${title}\n`));
    items.forEach((item, i) => {
      console.log(`  ${chalk.cyan(String(i + 1).padStart(2))}. ${item.label}${item.description ? chalk.dim(` — ${item.description}`) : ''}`);
    });
    const answer = await rl.question(chalk.cyan('\n  Number (or Enter to cancel): '));
    const n = parseInt(answer.trim(), 10);
    if (!n || n < 1 || n > items.length) return null;
    return items[n - 1].value;
  } finally {
    rl.close();
  }
}

export async function confirm(question: string, defaultYes = true): Promise<boolean> {
  const { createInterface } = await import('node:readline/promises');
  const rl = createInterface({ input, output });
  try {
    const suffix = defaultYes ? 'Y/n' : 'y/N';
    const answer = await rl.question(chalk.cyan(`  ${question} [${suffix}] `));
    const t = answer.trim().toLowerCase();
    if (!t) return defaultYes;
    return t === 'y' || t === 'yes';
  } finally {
    rl.close();
  }
}
