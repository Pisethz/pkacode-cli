import { relative } from 'node:path';
import chalk from 'chalk';

export type FileChangeAction = 'created' | 'modified' | 'deleted';

export interface FileChangeInfo {
  path: string;
  relativePath: string;
  action: FileChangeAction;
  oldContent?: string;
  newContent?: string;
  oldString?: string;
  newString?: string;
  startLine?: number;
  linesAdded?: number;
  linesRemoved?: number;
}

const MAX_DISPLAY_LINES = 48;
const CONTEXT_LINES = 2;

type DiffRow = {
  type: 'context' | 'add' | 'remove';
  oldNum?: number;
  newNum?: number;
  text: string;
};

/** Print a Codex/Cursor-style file change block to the terminal. */
export function printFileChange(change: FileChangeInfo): void {
  const label = {
    created: chalk.green('Created'),
    modified: chalk.yellow('Modified'),
    deleted: chalk.red('Deleted'),
  }[change.action];

  const icon = { created: '+', modified: '~', deleted: '−' }[change.action];
  const stats = formatStats(change);

  console.log('');
  console.log(
    chalk.dim('  ┌─') +
    chalk.bold(` ${icon} ${label} `) +
    chalk.cyan(change.relativePath) +
    (stats ? chalk.dim(`  ${stats}`) : '') +
    chalk.dim(' ─')
  );

  const rows = buildDiffRows(change);
  if (rows.length === 0) {
    console.log(chalk.dim('  │  (no content)'));
  } else {
    printDiffRows(rows);
  }

  console.log(chalk.dim('  └' + '─'.repeat(Math.min(60, process.stdout.columns || 60) - 2)));
}

/** Parse tool JSON result and display if it contains file change metadata. */
export function displayToolFileChange(
  toolName: string,
  result: string
): boolean {
  try {
    const data = JSON.parse(result) as Record<string, unknown>;
    if (data.error || !data.action || !data.path) return false;

    if (
      toolName !== 'write_file' &&
      toolName !== 'edit_file' &&
      toolName !== 'delete_file'
    ) {
      return false;
    }

    const change: FileChangeInfo = {
      path: String(data.path),
      relativePath: String(data.relativePath || data.path),
      action: data.action as FileChangeAction,
      oldContent: data.oldContent as string | undefined,
      newContent: data.newContent as string | undefined,
      oldString: data.oldString as string | undefined,
      newString: data.newString as string | undefined,
      startLine: data.startLine as number | undefined,
      linesAdded: data.linesAdded as number | undefined,
      linesRemoved: data.linesRemoved as number | undefined,
    };

    printFileChange(change);
    return true;
  } catch {
    return false;
  }
}

function formatStats(change: FileChangeInfo): string {
  if (change.linesAdded !== undefined || change.linesRemoved !== undefined) {
    const add = change.linesAdded ?? 0;
    const rem = change.linesRemoved ?? 0;
    if (add === 0 && rem === 0) return '';
    const parts: string[] = [];
    if (add > 0) parts.push(chalk.green(`+${add}`));
    if (rem > 0) parts.push(chalk.red(`−${rem}`));
    return parts.join(' ');
  }
  return '';
}

function buildDiffRows(change: FileChangeInfo): DiffRow[] {
  if (change.action === 'created' && change.newContent !== undefined) {
    return change.newContent.split('\n').map((text, i) => ({
      type: 'add' as const,
      newNum: i + 1,
      text,
    }));
  }

  if (change.action === 'deleted' && change.oldContent !== undefined) {
    return change.oldContent.split('\n').map((text, i) => ({
      type: 'remove' as const,
      oldNum: i + 1,
      text,
    }));
  }

  if (change.oldString !== undefined && change.newString !== undefined) {
    if (change.oldContent !== undefined) {
      return buildSurgicalDiffWithContext(
        change.oldContent,
        change.oldString,
        change.newString,
        change.startLine ?? 1
      );
    }
    return buildSurgicalDiff(
      change.oldString,
      change.newString,
      change.startLine ?? 1
    );
  }

  if (change.oldContent !== undefined && change.newContent !== undefined) {
    return buildLineDiff(change.oldContent, change.newContent);
  }

  return [];
}

function buildSurgicalDiff(
  oldString: string,
  newString: string,
  startLine: number
): DiffRow[] {
  const oldLines = oldString.split('\n');
  const newLines = newString.split('\n');
  const rows: DiffRow[] = [];

  for (let i = 0; i < oldLines.length; i++) {
    rows.push({
      type: 'remove',
      oldNum: startLine + i,
      text: oldLines[i],
    });
  }

  for (let i = 0; i < newLines.length; i++) {
    rows.push({
      type: 'add',
      newNum: startLine + i,
      text: newLines[i],
    });
  }

  return rows;
}

function buildSurgicalDiffWithContext(
  fileContent: string,
  oldString: string,
  newString: string,
  startLine: number
): DiffRow[] {
  const fileLines = fileContent.split('\n');
  const oldLines = oldString.split('\n');
  const newLines = newString.split('\n');
  const startIdx = startLine - 1;
  const endIdx = startIdx + oldLines.length - 1;
  const rows: DiffRow[] = [];

  for (let i = Math.max(0, startIdx - CONTEXT_LINES); i < startIdx; i++) {
    if (fileLines[i] === undefined) continue;
    rows.push({ type: 'context', oldNum: i + 1, newNum: i + 1, text: fileLines[i] });
  }

  for (let i = 0; i < oldLines.length; i++) {
    rows.push({ type: 'remove', oldNum: startLine + i, text: oldLines[i] });
  }

  for (let i = 0; i < newLines.length; i++) {
    rows.push({ type: 'add', newNum: startLine + i, text: newLines[i] });
  }

  for (let i = endIdx + 1; i <= Math.min(fileLines.length - 1, endIdx + CONTEXT_LINES); i++) {
    if (fileLines[i] === undefined) continue;
    rows.push({ type: 'context', oldNum: i + 1, newNum: i + 1, text: fileLines[i] });
  }

  return rows;
}

function buildLineDiff(oldContent: string, newContent: string): DiffRow[] {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const ops = lcsDiff(oldLines, newLines);

  const rows: DiffRow[] = [];
  let oldNum = 1;
  let newNum = 1;

  for (const op of ops) {
    if (op === 'equal') {
      rows.push({ type: 'context', oldNum, newNum, text: oldLines[oldNum - 1] });
      oldNum++;
      newNum++;
    } else if (op.type === 'remove') {
      rows.push({ type: 'remove', oldNum: op.oldIndex + 1, text: op.line });
      oldNum++;
    } else if (op.type === 'add') {
      rows.push({ type: 'add', newNum: op.newIndex + 1, text: op.line });
      newNum++;
    }
  }

  return collapseWithContext(rows);
}

type LcsOp =
  | 'equal'
  | { type: 'remove'; oldIndex: number; line: string }
  | { type: 'add'; newIndex: number; line: string };

function lcsDiff(oldLines: string[], newLines: string[]): LcsOp[] {
  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const ops: LcsOp[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.unshift('equal');
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'add', newIndex: j - 1, line: newLines[j - 1] });
      j--;
    } else {
      ops.unshift({ type: 'remove', oldIndex: i - 1, line: oldLines[i - 1] });
      i--;
    }
  }

  return ops;
}

function collapseWithContext(rows: DiffRow[]): DiffRow[] {
  const changed = new Set<number>();
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].type !== 'context') changed.add(i);
  }

  if (changed.size === 0) return rows;

  const keep = new Set<number>();
  for (const idx of changed) {
    for (let c = Math.max(0, idx - CONTEXT_LINES); c <= Math.min(rows.length - 1, idx + CONTEXT_LINES); c++) {
      keep.add(c);
    }
  }

  const result: DiffRow[] = [];
  let lastKept = -1;

  for (let i = 0; i < rows.length; i++) {
    if (!keep.has(i)) continue;
    if (lastKept >= 0 && i - lastKept > 1) {
      result.push({ type: 'context', text: '···' });
    }
    result.push(rows[i]);
    lastKept = i;
  }

  return result;
}

function printDiffRows(rows: DiffRow[]): void {
  const truncated = rows.length > MAX_DISPLAY_LINES;
  const display = truncated ? rows.slice(0, MAX_DISPLAY_LINES) : rows;

  for (const row of display) {
    if (row.text === '···') {
      console.log(chalk.dim('  │     ···'));
      continue;
    }

    const lineNum = padLineNum(row.oldNum ?? row.newNum);
    const prefix =
      row.type === 'add' ? chalk.green('+') :
      row.type === 'remove' ? chalk.red('−') :
      chalk.dim(' ');

    const text =
      row.type === 'add' ? chalk.green(row.text) :
      row.type === 'remove' ? chalk.red(row.text) :
      chalk.dim(row.text);

    console.log(chalk.dim(`  │ ${lineNum} `) + prefix + ' ' + text);
  }

  if (truncated) {
    console.log(chalk.dim(`  │     … ${rows.length - MAX_DISPLAY_LINES} more lines`));
  }
}

function padLineNum(n: number | undefined): string {
  if (!n) return '    ';
  return String(n).padStart(4, ' ');
}

/** Build relative path from cwd for display. */
export function toRelativePath(filePath: string): string {
  try {
    return relative(process.cwd(), filePath).replace(/\\/g, '/');
  } catch {
    return filePath;
  }
}

/** Count line additions/removals between two file contents. */
export function countLineChanges(oldContent: string, newContent: string): {
  linesAdded: number;
  linesRemoved: number;
} {
  const ops = lcsDiff(oldContent.split('\n'), newContent.split('\n'));
  let linesAdded = 0;
  let linesRemoved = 0;
  for (const op of ops) {
    if (op === 'equal') continue;
    if (op.type === 'add') linesAdded++;
    if (op.type === 'remove') linesRemoved++;
  }
  return { linesAdded, linesRemoved };
}
