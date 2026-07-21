import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import type { Config } from '../config.js';
import { registerTool } from './registry.js';

registerTool({
  name: 'ask_user',
  description: 'Ask the user a question and get their response. Use this when you need clarification, confirmation for destructive operations, or additional context to complete a task.',
  inputSchema: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'The question to ask the user',
      },
    },
    required: ['question'],
  },
  execute: async (args: Record<string, unknown>, _config: Config) => {
    const question = String(args.question);
    const rl = createInterface({ input, output });

    try {
      const answer = await rl.question(`\n\u{1F914} ${question}\n  > `);
      return JSON.stringify({ question, answer: answer.trim() });
    } finally {
      rl.close();
    }
  },
});
