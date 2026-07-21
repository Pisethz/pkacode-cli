import readline from 'node:readline';
import { stdout as output } from 'node:process';
import chalk from 'chalk';

export type AIActivity = 'thinking' | 'streaming' | 'tool' | 'done';

export interface TokenStats {
  prompt: number;
  completion: number;
  total: number;
}

/**
 * Live status + thinking display under the input box.
 *
 * Layout:
 *   ⏱ 1.2s  ·  tokens: …  ·  💭 Thinking  ·  model
 *
 *   ┌ Thinking
 *   │ first reasoning line...
 *   │ second reasoning line...
 *   └
 *
 * Status only refreshes in-place while nothing else has been printed yet.
 * Once thinking (or response) starts, status freezes so layout stays clean.
 */
export class AIStatusDisplay {
  private readonly modelName: string;
  private startTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private activity: AIActivity = 'thinking';
  private tokens: TokenStats = { prompt: 0, completion: 0, total: 0 };
  private active = false;
  private frozen = false;
  private thinkingOpen = false;
  private thinkingLineBuf = '';
  private atLineStart = true;

  constructor(modelName: string) {
    this.modelName = modelName;
  }

  start(activity: AIActivity = 'thinking'): void {
    this.startTime = Date.now();
    this.activity = activity;
    this.active = true;
    this.frozen = false;
    this.thinkingOpen = false;
    this.thinkingLineBuf = '';
    this.atLineStart = true;

    output.write('\n');
    this.writeStatusLine();
    this.timer = setInterval(() => {
      if (!this.frozen && this.active) {
        this.rewriteStatusInPlace();
      }
    }, 200);
  }

  setActivity(activity: AIActivity): void {
    this.activity = activity;
    if (!this.frozen) this.rewriteStatusInPlace();
  }

  setTokens(usage: { promptTokens: number; completionTokens: number; totalTokens: number }): void {
    this.tokens = {
      prompt: usage.promptTokens,
      completion: usage.completionTokens,
      total: usage.totalTokens,
    };
    if (!this.frozen) this.rewriteStatusInPlace();
  }

  /**
   * Stream reasoning text as a clean indented block under the status line.
   * Freezes status updates so cursor gymnastics do not scramble the layout.
   */
  appendThinking(chunk: string): void {
    if (!chunk) return;
    this.freezeStatus();

    if (!this.thinkingOpen) {
      this.thinkingOpen = true;
      this.activity = 'thinking';
      output.write('\n');
      output.write(chalk.dim('  ┌ ') + chalk.bold.dim('Thinking') + '\n');
      this.atLineStart = true;
    }

    for (const ch of chunk) {
      if (ch === '\n') {
        this.flushThinkingLine();
        this.atLineStart = true;
        continue;
      }
      if (this.atLineStart) {
        output.write(chalk.dim('  │ '));
        this.atLineStart = false;
      }
      output.write(chalk.dim.italic(ch));
      this.thinkingLineBuf += ch;
    }
  }

  /** Close the thinking block before the AI response starts. */
  closeThinking(): void {
    if (!this.thinkingOpen) return;
    this.flushThinkingLine();
    output.write(chalk.dim('  └') + '\n');
    this.thinkingOpen = false;
    this.atLineStart = true;
  }

  trackNewline(_count = 1): void {
    this.freezeStatus();
  }

  stop(activity: AIActivity = 'done'): void {
    if (!this.active) return;
    this.closeThinking();
    this.activity = activity;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    output.write('\n');
    this.writeStatusLine();
    output.write('\n');
    this.active = false;
  }

  private freezeStatus(): void {
    this.frozen = true;
  }

  private flushThinkingLine(): void {
    if (!this.atLineStart) {
      output.write('\n');
    } else {
      // empty blank line inside thinking
      output.write(chalk.dim('  │') + '\n');
    }
    this.thinkingLineBuf = '';
    this.atLineStart = true;
  }

  private formatElapsed(): string {
    const seconds = (Date.now() - this.startTime) / 1000;
    return seconds < 60
      ? `${seconds.toFixed(1)}s`
      : `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(0)}s`;
  }

  private formatTokenText(): string {
    if (this.tokens.total > 0) {
      return `↑${this.tokens.prompt.toLocaleString()} ↓${this.tokens.completion.toLocaleString()} (${this.tokens.total.toLocaleString()} total)`;
    }
    return 'tokens: …';
  }

  private activityLabel(): string {
    switch (this.activity) {
      case 'thinking': return '💭 Thinking';
      case 'streaming': return '✍ Responding';
      case 'tool': return '🔧 Tools';
      case 'done': return '✓ Done';
    }
  }

  private formatStatus(): string {
    return `⏱ ${this.formatElapsed()}  ·  ${this.formatTokenText()}  ·  ${this.activityLabel()}  ·  ${this.modelName}`;
  }

  private writeStatusLine(): void {
    output.write(chalk.dim('  ' + this.formatStatus()));
  }

  private rewriteStatusInPlace(): void {
    readline.cursorTo(output, 0);
    readline.clearLine(output, 0);
    this.writeStatusLine();
  }
}
