import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import type { Config } from '../config.js';
import { registerTool } from './registry.js';
import { toRelativePath, countLineChanges } from '../ui/diff.js';

registerTool({
  name: 'write_file',
  description: 'Create a new file or overwrite an existing file with new content. Creates parent directories if they do not exist.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path where to write the file (relative to current working directory)',
      },
      content: {
        type: 'string',
        description: 'The full content to write to the file',
      },
    },
    required: ['path', 'content'],
  },
  execute: async (args: Record<string, unknown>, _config: Config) => {
    const filePath = resolve(process.cwd(), String(args.path));
    const content = String(args.content);
    const dir = dirname(filePath);
    const existed = existsSync(filePath);
    const oldContent = existed ? readFileSync(filePath, 'utf-8') : '';

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(filePath, content, 'utf-8');
    const lines = content.split('\n').length;
    const action = existed ? 'modified' : 'created';
    const { linesAdded, linesRemoved } = existed
      ? countLineChanges(oldContent, content)
      : { linesAdded: lines, linesRemoved: 0 };

    return JSON.stringify({
      path: filePath,
      relativePath: toRelativePath(filePath),
      size: content.length,
      lines,
      action,
      oldContent: existed ? oldContent : undefined,
      newContent: content,
      linesAdded,
      linesRemoved,
    });
  },
});
