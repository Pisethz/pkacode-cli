import type { SessionOptions } from '../chat/options.js';
import type { RuntimePermissions } from '../permissions/engine.js';

export type { SessionOptions };

export async function runChat(options: SessionOptions = {}): Promise<void> {
  const { startInteractiveSession } = await import('../chat/interactive.js');
  await startInteractiveSession(options);
}

export async function runPrint(prompt: string, runtime?: Partial<RuntimePermissions>): Promise<void> {
  if (!prompt?.trim()) {
    throw new Error('Print mode requires a prompt. Usage: pka -p "your prompt"');
  }
  await runChat({ prompt: prompt.trim(), print: true, runtime });
}
