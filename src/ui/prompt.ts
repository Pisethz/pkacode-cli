import { createInterface } from 'node:readline/promises';
import readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import {
  SLASH_COMMAND_NAMES,
  SLASH_COMMAND_DESCRIPTIONS,
  printAllPkaCommands,
} from '../commands/catalog.js';

// ── Version from package.json ───────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, '..', '..', 'package.json');
function getVersion(): string {
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf-8')).version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}
const VERSION = getVersion();

// Strip ANSI escape codes for accurate width measurement
const visibleLen = (s: string): number => s.replace(/\x1b\[[0-9;]*m/g, '').length;

// ── Command autocomplete ────────────────────────────────────

function getCommandHits(buffer: string): string[] {
  const trimmed = buffer.trim();
  if (!trimmed.startsWith('/')) return [];

  // /pka … subcommand suggestions
  if (trimmed === '/pka' || trimmed.startsWith('/pka ')) {
    const PKA_SUBS = [
      '/pka auth login',
      '/pka auth status',
      '/pka auth logout',
      '/pka models list',
      '/pka models list --provider gemini',
      '/pka models list --provider groq',
      '/pka models list --provider openrouter',
      '/pka models refresh',
      '/pka models pin',
      '/pka provider set gemini',
      '/pka provider set groq',
      '/pka provider set openrouter',
      '/pka model set',
      '/pka sessions list',
      '/pka sessions clear',
      '/pka resume',
      '/pka permissions',
      '/pka sandbox on',
      '/pka sandbox off',
      '/pka config',
      '/pka help',
    ];
    return PKA_SUBS.filter(c => c.startsWith(trimmed));
  }

  // Stop suggesting once args start (space after slash command)
  if (/\s/.test(trimmed)) return [];
  return SLASH_COMMAND_NAMES.filter(c => c.startsWith(trimmed));
}

function buildSuggestionPopup(hits: string[], selectedIndex: number): string[] {
  if (hits.length === 0) return [];

  const boxW = getBoxWidth();
  const lines: string[] = [];

  const header = chalk.dim('  ┌ ') + chalk.bold.cyan('Commands') + chalk.dim('  ↑↓ Tab Enter Esc');
  lines.push(fitVisible(header, boxW));

  hits.forEach((cmd, i) => {
    const desc =
      SLASH_COMMAND_DESCRIPTIONS[cmd] ||
      (cmd.startsWith('/pka') ? 'PKA CLI' : '');
    const marker = i === selectedIndex ? chalk.cyan('›') : ' ';
    const name = i === selectedIndex ? chalk.bold.cyan(cmd) : chalk.white(cmd);
    lines.push(fitVisible(`  │ ${marker} ${name}  ${chalk.dim(desc)}`, boxW));
  });

  lines.push(fitVisible(chalk.dim('  └' + '─'.repeat(Math.min(boxW - 4, Math.max(12, boxW - 8)))), boxW));
  return lines;
}

/** Truncate/pad a string to an exact visible width (no terminal wrap). */
function fitVisible(s: string, width: number): string {
  const len = visibleLen(s);
  if (len === width) return s;
  if (len < width) return s + ' '.repeat(width - len);
  // Truncate by stripping ANSI-aware: keep removing from end of raw until fit
  let out = s;
  while (visibleLen(out) > width - 1 && out.length > 0) {
    out = out.slice(0, -1);
  }
  return out + '…';
}

// ── Center helper ───────────────────────────────────────────

function centerLine(line: string, width: number): string {
  const len = visibleLen(line);
  const pad = Math.max(0, Math.floor((width - len) / 2));
  return ' '.repeat(pad) + line;
}

function boxLine(content: string, boxInner: number): string {
  const visible = visibleLen(content);
  const rightPad = Math.max(0, boxInner - visible);
  return chalk.dim('┃') + content + ' '.repeat(rightPad) + chalk.dim('┃');
}

// ── Centered Startup Panel with Border Box ─────────────────

export function printStartupPanel(modelName: string, modeText?: string): void {
  const termWidth = process.stdout.columns || 100;
  const boxW = Math.min(termWidth - 4, 88);
  const innerW = boxW - 2;
  const title = `${chalk.bold.yellow('P')}${chalk.bold.green('K')}${chalk.bold.cyan('A')} ${chalk.bold.magenta('C')}${chalk.bold.red('O')}${chalk.bold.yellow('D')}${chalk.bold.green('E')}`;

  // ── Build content lines ───────────────────────────────────
  const contentLines: string[] = [];

  // Logo
  contentLines.push('');
  contentLines.push(centerLine(
    `${chalk.blue('█████▀█████ ████ ████ ████▀████')}  ${chalk.cyan('█████▀████ ▄███▀███▄ ████▀███▄ ████▀████')}`, innerW));
  contentLines.push(centerLine(
    `${chalk.blue('█████ █████ ████ ████ ████ ████')}  ${chalk.cyan('█████ ████ ████ ████ ████ ████ ████ ████')}`, innerW));
  contentLines.push(centerLine(
    `${chalk.blue('█████ █████ ████▄███▄ ████ ████')}  ${chalk.cyan('█████ ▀▀▀▀ ████ ████ ████ ████ ████ ▀▀▀▀')}`, innerW));
  contentLines.push(centerLine(
    `${chalk.blue('█████▄█████ ████ ████ ████ ████')}  ${chalk.cyan('█████      ████ ████ ████ ████ ████▀▀   ')}`, innerW));
  contentLines.push(centerLine(
    `${chalk.blue('█████       ████ ████ ████▀████')}  ${chalk.cyan('█████▄████ ▀███▄███▀ ████▄███▀ ████▄████')}`, innerW));

  // Title + Version
  contentLines.push('');
  contentLines.push(centerLine(`  ${title}  ${chalk.dim(`v${VERSION}`)}`, innerW));
  contentLines.push(centerLine(`  ${chalk.dim('Model:')}  ${chalk.cyan(modelName)}`, innerW));
  if (modeText) {
    contentLines.push(centerLine(`  ${chalk.dim('Mode:')}   ${modeText}`, innerW));
  }
  contentLines.push(centerLine(`  ${chalk.dim('Providers:')}  ${chalk.green('Gemini')}  ·  ${chalk.cyan('Groq')}  ·  ${chalk.magenta('OpenRouter')}  ·  ${chalk.blue('OpenRouter 2')}  ${chalk.dim('(FREE)')}`, innerW));

  // Separator
  contentLines.push('');
  contentLines.push(centerLine(chalk.dim('────────────────────────────────────'), innerW));
  contentLines.push('');

  // Two-column: Getting Started (left) | What's New + Commands (right)
  const colHalf = Math.floor(innerW / 2) - 2;

  const col1 = [
    chalk.bold.green('  GETTING STARTED'),
    chalk.dim('  ───────────────'),
    '',
    '  Just describe what you want:',
    `  ${chalk.cyan('"Build a todo app with React"')}`,
    `  ${chalk.cyan('"Explain this function"')}`,
    `  ${chalk.cyan('"Run npm test"')}`,
    `  ${chalk.cyan('"Find files about auth"')}`,
    '',
    `  ${chalk.green('/session')}    Show current session info`,
    `  ${chalk.green('/new')}        Start a fresh session`,
    `  ${chalk.green('/resume')}     Pick & continue a session`,
    `  ${chalk.green('/permissions')} Change permission mode`,
    `  ${chalk.green('/help')}       Show all commands`,
  ];

  const col2 = [
    chalk.bold.magenta("  WHAT'S NEW"),
    chalk.dim('  ───────────────'),
    '',
    `  ${chalk.cyan('/session')}  — View session details`,
    `  ${chalk.cyan('/new')}      — Create new session`,
    `  ${chalk.cyan('/resume')}   — Interactive picker`,
    `  ${chalk.cyan('/perm')}     — Interactive mode select`,
    `  ${chalk.cyan('Alt+↑↓')}    — Command autocomplete`,
    '',
    chalk.bold.cyan('  QUICK ACTIONS'),
    chalk.dim('  ───────────────'),
    `  ${chalk.green('/new')}       fresh session`,
    `  ${chalk.green('/resume')}    pick saved session`,
    `  ${chalk.green('/permissions')}  change mode`,
    `  ${chalk.green('/info')}      session overview`,
  ];

  const maxCol = Math.max(col1.length, col2.length);
  for (let i = 0; i < maxCol; i++) {
    const left = i < col1.length ? col1[i] : '';
    const right = i < col2.length ? col2[i] : '';
    const leftPad = left + ' '.repeat(Math.max(0, colHalf - visibleLen(left)));
    contentLines.push(`  ${leftPad}  ${right}`);
  }

  contentLines.push('');

  // ── Render with border box ────────────────────────────────
  const leftMargin = Math.floor((termWidth - boxW) / 2);

  console.log('');
  console.log(' '.repeat(leftMargin) + chalk.dim(`┏${'━'.repeat(boxW - 2)}┓`));
  for (const line of contentLines) {
    console.log(' '.repeat(leftMargin) + boxLine(line, innerW));
  }
  console.log(' '.repeat(leftMargin) + chalk.dim(`┗${'━'.repeat(boxW - 2)}┛`));
  console.log('');
}

// ── Help Panel ──────────────────────────────────────────────

export function printHelp(): void {
  printAllPkaCommands();
}

// ── Terminal resize handling ───────────────────────────────

let cachedTermWidth = process.stdout.columns || 100;

if (process.stdout.isTTY) {
  process.stdout.on('resize', () => {
    cachedTermWidth = process.stdout.columns || 100;
  });
}

// ── Stats Info ──────────────────────────────────────────────

export interface StatsInfo {
  /** Prompt tokens used this session */
  promptTokens: number;
  /** Completion tokens used this session */
  completionTokens: number;
  /** Max tokens per response from config */
  maxTokens: number;
  /** Callback to get live session elapsed time */
  getSessionTime: () => string;
}

function buildStatsLine(stats?: StatsInfo): string {
  if (!stats) return '';
  const text = `⚡↑${stats.promptTokens.toLocaleString()}/↓${stats.completionTokens.toLocaleString()}/${stats.maxTokens.toLocaleString()}  ·  ${stats.getSessionTime()}`;
  return ' ' + chalk.dim(text);
}

// ── Prompt ──────────────────────────────────────────────────

const PLACEHOLDER_TEXT = 'Ask PKA to build, edit, or run something…';
const PLACEHOLDER = chalk.dim(PLACEHOLDER_TEXT);

/** Returned by getPromptInput when user presses Ctrl+C to quit. */
export const PROMPT_QUIT = Symbol('PROMPT_QUIT');
export type PromptInputResult = string | null | typeof PROMPT_QUIT;

const CURSOR_SHOW = '\x1b[?25h';
const CURSOR_HIDE = '\x1b[?25l';
const INPUT_PREFIX = '> '; // ASCII only — Unicode width breaks Windows layout

function getBoxWidth(): number {
  // Full terminal width (minus 1 to avoid Windows wrap at exact columns)
  const cols = cachedTermWidth || 80;
  return Math.max(40, cols - 1);
}

function getInputPrefixWidth(): number {
  return 1 + visibleLen(INPUT_PREFIX); // leading space + ›␠
}

function getInputCursorCol(inputValue: string, boxW: number): number {
  const innerW = boxW - 2;
  const prefixWidth = getInputPrefixWidth();
  const maxTextWidth = Math.max(1, innerW - prefixWidth);
  let textWidth = 0;
  if (inputValue.length > 0) {
    let visible = inputValue;
    if (visibleLen(visible) > maxTextWidth) {
      visible = visible.slice(-(maxTextWidth));
    }
    textWidth = visibleLen(visible);
  }
  return 1 + prefixWidth + textWidth; // after ┃
}

/**
 *   ┌─ model ────────────────────────┐
 *   │ › typed text                   │
 *   └────────────────────────────────┘
 */
function buildBoxLines(
  modelName: string,
  boxW: number,
  inputValue: string
): [string, string, string] {
  const innerW = boxW - 2;
  const prefixStyled = chalk.cyan(INPUT_PREFIX);
  const prefixWidth = getInputPrefixWidth();
  const maxTextWidth = Math.max(1, innerW - prefixWidth);

  const tag = ` ${modelName} `;
  const tagLen = visibleLen(tag);
  const left = Math.max(1, Math.floor((innerW - tagLen) / 2));
  const right = Math.max(1, innerW - tagLen - left);
  const top =
    chalk.dim(`┌${'─'.repeat(left)}`) +
    chalk.cyan(tag) +
    chalk.dim(`${'─'.repeat(right)}┐`);

  let styledText: string;
  let textWidth: number;
  if (inputValue.length === 0) {
    const ph = PLACEHOLDER_TEXT.length > maxTextWidth
      ? PLACEHOLDER_TEXT.slice(0, maxTextWidth - 1) + '…'
      : PLACEHOLDER_TEXT;
    styledText = chalk.dim(ph);
    textWidth = visibleLen(ph);
  } else {
    let visible = inputValue;
    if (visibleLen(visible) > maxTextWidth) {
      visible = '…' + visible.slice(-(maxTextWidth - 1));
    }
    styledText = visible;
    textWidth = visibleLen(visible);
  }

  const rightPad = Math.max(0, innerW - prefixWidth - textWidth);
  const middle =
    chalk.dim('│') +
    ' ' +
    prefixStyled +
    styledText +
    ' '.repeat(rightPad) +
    chalk.dim('│');

  const bottom = chalk.dim(`└${'─'.repeat(innerW)}┘`);
  return [top, middle, bottom];
}

function drawStaticBoxFrame(modelName: string, inputValue = ''): void {
  const [top, middle, bottom] = buildBoxLines(modelName, getBoxWidth(), inputValue);
  output.write('\n' + top + '\n' + middle + '\n' + bottom + '\n');
  output.write(CURSOR_SHOW);
}

/**
 * Move cursor to the last line of the previous frame, then clear upward.
 * Call this ONLY when cursor is known to be either on last line OR on middle
 * (onMiddle=true).
 */
function eraseFrame(lineCount: number, onMiddle: boolean): void {
  if (lineCount <= 0) return;

  output.write(CURSOR_HIDE);

  // From middle row → last row first
  if (onMiddle && lineCount > 1) {
    const down = lineCount - 1 - 1; // middle index=1
    if (down > 0) readline.moveCursor(output, 0, down);
  }

  // Now on last line: walk up clearing
  for (let i = 0; i < lineCount; i++) {
    readline.cursorTo(output, 0);
    readline.clearLine(output, 0);
    if (i < lineCount - 1) {
      readline.moveCursor(output, 0, -1);
    }
  }
  readline.cursorTo(output, 0);
}

/**
 * Draw frame and park blink cursor on the input row.
 * Returns { lineCount, onMiddle: true }.
 */
function paintFrame(
  modelName: string,
  inputValue: string,
  selectedIndex: number,
  prevLineCount: number,
  prevOnMiddle: boolean,
  stats?: StatsInfo
): { lineCount: number; onMiddle: boolean } {
  const boxW = getBoxWidth();
  const [top, middle, bottom] = buildBoxLines(modelName, boxW, inputValue);
  const statsLine = buildStatsLine(stats);
  const hits = getCommandHits(inputValue);
  const popup = buildSuggestionPopup(
    hits,
    Math.max(0, Math.min(selectedIndex, Math.max(0, hits.length - 1)))
  );
  const lines = statsLine
    ? [top, middle, bottom, statsLine, ...popup]
    : [top, middle, bottom, ...popup];

  eraseFrame(prevLineCount, prevOnMiddle);

  for (let i = 0; i < lines.length; i++) {
    readline.cursorTo(output, 0);
    // Keep each logical line from wrapping
    output.write(fitVisible(lines[i], boxW));
    if (i < lines.length - 1) output.write('\n');
  }

  // Park on middle (index 1)
  const downFromEnd = lines.length - 1 - 1;
  if (downFromEnd > 0) readline.moveCursor(output, 0, -downFromEnd);
  readline.cursorTo(output, getInputCursorCol(inputValue, boxW));
  output.write(CURSOR_SHOW);

  return { lineCount: lines.length, onMiddle: true };
}

/** Move from middle parked cursor to after the frame, then newline. */
function exitFrame(lineCount: number, onMiddle: boolean): void {
  if (lineCount <= 0) {
    output.write('\n');
    return;
  }
  if (onMiddle && lineCount > 1) {
    const down = lineCount - 1 - 1;
    if (down > 0) readline.moveCursor(output, 0, down);
  }
  readline.cursorTo(output, 0);
  output.write('\n');
}

export function restoreTerminal(): void {
  try {
    if (input.isTTY && typeof input.setRawMode === 'function') {
      input.setRawMode(false);
    }
  } catch {
    // ignore
  }
  output.write(CURSOR_SHOW);
  output.write('\x1b[0m');
  resetScrollRegion();
}

/**
 * Read a line inside the bordered box.
 * Returns text, null (empty Enter), or PROMPT_QUIT (Ctrl+C / Ctrl+D).
 */
async function readLineInBox(modelName: string, stats?: StatsInfo): Promise<PromptInputResult> {
  if (!input.isTTY) {
    const rl = createInterface({ input, output, prompt: '' });
    try {
      const answer = await rl.question('');
      return answer.trim() || null;
    } finally {
      rl.close();
    }
  }

  readline.emitKeypressEvents(input);

  return new Promise((resolve) => {
    let buffer = '';
    let selectedIndex = 0;
    let lineCount = 0;
    let onMiddle = false;
    let popupOpen = false;
    let suppressPopup = false;
    let done = false;

    const hits = () => (suppressPopup ? [] : getCommandHits(buffer));
    let liveTimer: ReturnType<typeof setInterval> | null = null;

    const redraw = () => {
      const h = hits();
      popupOpen = h.length > 0;
      if (selectedIndex >= h.length) selectedIndex = Math.max(0, h.length - 1);
      if (lineCount === 0) output.write('\n');
      const next = paintFrame(modelName, buffer, selectedIndex, lineCount, onMiddle, stats);
      lineCount = next.lineCount;
      onMiddle = next.onMiddle;
    };

    const cleanup = () => {
      if (liveTimer) clearInterval(liveTimer);
      input.removeListener('keypress', onKeypress);
      try {
        input.setRawMode(false);
      } catch {
        // ignore
      }
      output.write(CURSOR_SHOW);
    };

    const finish = (value: PromptInputResult) => {
      if (done) return;
      done = true;
      cleanup();
      exitFrame(lineCount, onMiddle);
      onMiddle = false;
      resolve(value);
    };

    const quitClean = () => {
      if (done) return;
      done = true;
      cleanup();
      eraseFrame(lineCount, onMiddle);
      output.write('\n');
      resolve(PROMPT_QUIT);
    };

    const onKeypress = (str: string | undefined, key: readline.Key) => {
      if (!key || done) return;

      if (key.ctrl && key.name === 'c') {
        quitClean();
        return;
      }
      if (key.ctrl && key.name === 'd' && buffer.length === 0) {
        quitClean();
        return;
      }

      if (key.name === 'escape') {
        if (popupOpen || getCommandHits(buffer).length > 0) {
          suppressPopup = true;
          selectedIndex = 0;
          redraw();
        }
        return;
      }

      if (popupOpen && key.name === 'up') {
        const h = hits();
        if (h.length) {
          selectedIndex = (selectedIndex - 1 + h.length) % h.length;
          redraw();
        }
        return;
      }
      if (popupOpen && key.name === 'down') {
        const h = hits();
        if (h.length) {
          selectedIndex = (selectedIndex + 1) % h.length;
          redraw();
        }
        return;
      }

      if (key.name === 'tab') {
        const h = hits();
        if (h.length > 0) {
          buffer = h[Math.min(selectedIndex, h.length - 1)];
          selectedIndex = 0;
          suppressPopup = true;
          redraw();
        }
        return;
      }

      if (key.name === 'return') {
        const h = hits();
        if (h.length > 0) {
          finish(h[Math.min(selectedIndex, h.length - 1)]);
          return;
        }
        const trimmed = buffer.trim();
        finish(!trimmed ? null : trimmed);
        return;
      }

      if (key.name === 'backspace') {
        buffer = buffer.slice(0, -1);
        selectedIndex = 0;
        if (buffer.startsWith('/')) suppressPopup = false;
        redraw();
        return;
      }

      if (str && !key.ctrl && !key.meta) {
        // Ignore pure control keys that still emit a str
        if (key.name === 'return' || key.name === 'escape') return;
        buffer += str;
        selectedIndex = 0;
        if (buffer.startsWith('/') && !/\s/.test(buffer)) suppressPopup = false;
        redraw();
      }
    };

    try {
      input.setRawMode(true);
    } catch {
      // ignore
    }
    input.resume();
    input.on('keypress', onKeypress);
    redraw();

    // Live timer — refresh only the stats line in-place (no full redraw flicker)
    if (stats) {
      liveTimer = setInterval(() => {
        if (done || !onMiddle) return;
        const boxW = getBoxWidth();
        const statsLine = buildStatsLine(stats);
        if (!statsLine) return;
        // Stats line is always 2 rows below middle (index 1 → index 3)
        readline.moveCursor(output, 0, 2);
        readline.cursorTo(output, 0);
        readline.clearLine(output, 0);
        output.write(fitVisible(statsLine, boxW));
        // Move back to middle and restore cursor column
        readline.moveCursor(output, 0, -2);
        const col = getInputCursorCol(buffer, boxW);
        readline.cursorTo(output, col);
      }, 1000);
    }
  });
}

export function resetScrollRegion(): void {
  output.write('\x1b[r');
}

export function drawInputBoxBottom(modelName: string): void {
  restoreTerminal();
  drawStaticBoxFrame(modelName);
}

export async function getPromptInput(modelName: string, stats?: StatsInfo): Promise<PromptInputResult> {
  return readLineInBox(modelName, stats);
}

export async function getMultilineInput(): Promise<string> {
  const rl = createInterface({
    input,
    output,
    prompt: '',
  });

  const lines: string[] = [];
  console.log(chalk.dim('  (blank line or /send to finish)'));

  try {
    while (true) {
      const line = await rl.question(chalk.cyan('  > '));
      if (line.trim() === '' || line.trim() === '/send') break;
      lines.push(line);
    }
  } finally {
    rl.close();
  }

  return lines.join('\n');
}
