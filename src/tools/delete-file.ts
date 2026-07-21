import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Config } from '../config.js';
import { registerTool } from './registry.js';
import { toRelativePath } from '../ui/diff.js';

registerTool({
  name: 'delete_file',
  description: 'Delete a file at the given path. Use when the user asks to remove or delete a file.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to delete (relative to current working directory)',
      },
    },
    required: ['path'],
  },
  execute: async (args: Record<string, unknown>, _config: Config) => {
    const filePath = resolve(process.cwd(), String(args.path));

    if (!existsSync(filePath)) {
      return JSON.stringify({
        error: `File not found: "${args.path}"`,
        path: filePath,
      });
    }

    const oldContent = readFileSync(filePath, 'utf-8');
    unlinkSync(filePath);
    const lines = oldContent.split('\n').length;

    return JSON.stringify({
      path: filePath,
      relativePath: toRelativePath(filePath),
      action: 'deleted',
      oldContent,
      linesRemoved: lines,
    });
  },
});
