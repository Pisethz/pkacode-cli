import chalk from 'chalk';

const W = '\x1b[37m';
const RST = '\x1b[0m';
const MARGIN = '      ';

function visibleLen(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, '').length;
}

function boxWidth(): number {
  return Math.max(10, (process.stdout.columns || 80) - MARGIN.length - 2);
}

function wrapLine(text: string, max: number): string[] {
  if (visibleLen(text) <= max) return [text];
  const result: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? line + ' ' + word : word;
    if (visibleLen(next) <= max) {
      line = next;
    } else {
      if (line) result.push(line);
      line = word;
    }
  }
  if (line) result.push(line);
  return result;
}

function padTo(s: string, len: number): string {
  return s + ' '.repeat(Math.max(0, len - visibleLen(s)));
}

function processInline(text: string): string {
  let t = text;
  t = t.replace(/`([^`]+)`/g, (_, code) => chalk.bgGray.white(code));
  t = t.replace(/\*\*([^*]+)\*\*/g, (_, bold) => chalk.bold(bold));
  t = t.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_, italic) => chalk.italic(italic));
  return t;
}

function highlightCode(line: string, language: string): string {
  let h = line;
  if (language === 'json' || language === 'jsonc') {
    h = h.replace(/"([^"]+)"(?=\s*:)/g, (_, key) => chalk.cyan(`"${key}"`));
    h = h.replace(/:\s*"([^"]*)"/g, (_, val) => `: ${chalk.green(`"${val}"`)}`);
    h = h.replace(/:\s*(\d+\.?\d*)/g, (_, num) => `: ${chalk.yellow(num)}`);
    return h;
  }
  if (['js', 'jsx', 'ts', 'tsx', 'javascript', 'typescript'].includes(language)) {
    const keywords = /\b(const|let|var|function|return|if|else|for|while|import|export|from|async|await|class|new|this|typeof|try|catch|throw|interface|type|extends|implements|enum|switch|case|default|break|continue|yield|of|in|as|import type)\b/g;
    h = h.replace(keywords, (_, kw) => chalk.magenta(kw));
    h = h.replace(/(["'`])(.*?)\1/g, (_, q, s) => chalk.green(q + s + q));
    h = h.replace(/\b(\d+\.?\d*)\b/g, (_, num) => chalk.yellow(num));
    h = h.replace(/\/\/.*$/g, (_, c) => chalk.gray(c));
    return h;
  }
  if (language === 'diff') {
    if (line.startsWith('+')) return chalk.green(line);
    if (line.startsWith('-')) return chalk.red(line);
    if (line.startsWith('@@')) return chalk.cyan(line);
    return line;
  }
  if (language === 'bash' || language === 'shell' || language === 'sh') {
    if (line.startsWith('$ ') || line.startsWith('#')) return chalk.gray(line);
    return line;
  }
  return line;
}

export function renderMarkdown(text: string): void {
  if (!text) return;

  const rawLines = text.split('\n');
  const inner = boxWidth() - 2;

  console.log(W + MARGIN + '┌' + '─'.repeat(boxWidth()) + '┐' + RST);

  let inCodeBlock = false;
  let codeLang = '';
  let codeLines: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        for (const cl of codeLines) {
          const highlighted = highlightCode(cl, codeLang);
          console.log(W + MARGIN + '│ ' + padTo(chalk.dim('│') + ' ' + highlighted, inner) + ' │' + RST);
        }
        codeLines = [];
        codeLang = '';
        inCodeBlock = false;
        continue;
      } else {
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim();
        continue;
      }
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      console.log(W + MARGIN + '│ ' + ' '.repeat(inner) + ' │' + RST);
      continue;
    }

    if (trimmed.startsWith('### ')) {
      const lines = wrapLine(trimmed.slice(4), inner);
      for (const l of lines) { console.log(W + MARGIN + '│ ' + padTo(chalk.bold.cyan(l), inner) + ' │' + RST); }
      continue;
    }
    if (trimmed.startsWith('## ')) {
      const lines = wrapLine(trimmed.slice(3), inner);
      for (const l of lines) { console.log(W + MARGIN + '│ ' + padTo(chalk.bold.cyan(l), inner) + ' │' + RST); }
      continue;
    }
    if (trimmed.startsWith('# ')) {
      const lines = wrapLine(trimmed.slice(2), inner);
      for (const l of lines) { console.log(W + MARGIN + '│ ' + padTo(chalk.bold.underline.cyan(l), inner) + ' │' + RST); }
      continue;
    }
    if (trimmed.startsWith('> ')) {
      const lines = wrapLine(trimmed.slice(2), inner - 2);
      for (const l of lines) { console.log(W + MARGIN + '│ ' + padTo(chalk.dim.italic(`│ ${l}`), inner) + ' │' + RST); }
      continue;
    }
    if (/^[-*_]{3,}$/.test(trimmed)) {
      console.log(W + MARGIN + '│ ' + padTo(chalk.dim('─'.repeat(inner)), inner) + ' │' + RST);
      continue;
    }
    if (/^[\s]*[-*+] /.test(trimmed)) {
      const content = trimmed.replace(/^[\s]*[-*+] /, '');
      const lines = wrapLine(content, inner - 4);
      for (const l of lines) { console.log(W + MARGIN + '│ ' + padTo('  ' + chalk.green('•') + ' ' + processInline(l), inner) + ' │' + RST); }
      continue;
    }
    if (/^[\s]*\d+\.\s/.test(trimmed)) {
      const content = trimmed.replace(/^[\s]*\d+\.\s/, '');
      const lines = wrapLine(content, inner - 4);
      for (const l of lines) { console.log(W + MARGIN + '│ ' + padTo('  ' + chalk.green('→') + ' ' + processInline(l), inner) + ' │' + RST); }
      continue;
    }

    const lines = wrapLine(trimmed, inner);
    for (const l of lines) { console.log(W + MARGIN + '│ ' + padTo(processInline(l), inner) + ' │' + RST); }
  }

  if (inCodeBlock && codeLines.length > 0) {
    for (const cl of codeLines) {
      const highlighted = highlightCode(cl, codeLang);
      console.log(W + MARGIN + '│ ' + padTo(chalk.dim('│') + ' ' + highlighted, inner) + ' │' + RST);
    }
  }

  console.log(W + MARGIN + '└' + '─'.repeat(boxWidth()) + '┘' + RST);
}

export function printDivider(): void {
  console.log(chalk.dim('─'.repeat(process.stdout.columns || 50)));
}
