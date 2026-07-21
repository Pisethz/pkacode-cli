import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Config } from '../config.js';
import { registerTool } from './registry.js';

registerTool({
  name: 'read_file',
  description: 'Read the contents of a file at the given path. Returns the full file contents and metadata.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to read (relative to current working directory)',
      },
    },
    required: ['path'],
  },
  execute: async (args: Record<string, unknown>, _config: Config) => {
    const filePath = resolve(process.cwd(), String(args.path));
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    return JSON.stringify({
      path: filePath,
      size: content.length,
      lines: lines.length,
      content,
    });
  },
});
