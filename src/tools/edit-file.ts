import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Config } from '../config.js';
import { registerTool } from './registry.js';
import { toRelativePath } from '../ui/diff.js';

registerTool({
  name: 'edit_file',
  description: 'Make an exact string replacement in a file. Use this to make surgical edits to existing files. You must provide the exact old string to be replaced and the new string to replace it with.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to edit (relative to current working directory)',
      },
      old_string: {
        type: 'string',
        description: 'The exact string to search for and replace',
      },
      new_string: {
        type: 'string',
        description: 'The new string to replace the old string with',
      },
    },
    required: ['path', 'old_string', 'new_string'],
  },
  execute: async (args: Record<string, unknown>, _config: Config) => {
    const filePath = resolve(process.cwd(), String(args.path));
    const oldString = String(args.old_string);
    const newString = String(args.new_string);

    const content = readFileSync(filePath, 'utf-8');

    if (!content.includes(oldString)) {
      return JSON.stringify({
        error: `Could not find the exact string to replace in "${args.path}". The string was not found in the file.`,
        path: filePath,
        hint: 'Make sure the old_string matches the file content exactly, including whitespace.',
      });
    }

    const occurrences = (content.match(new RegExp(escapeRegex(oldString), 'g')) || []).length;
    if (occurrences > 1) {
      return JSON.stringify({
        error: `Found ${occurrences} occurrences of the old_string in the file. The replacement string must be unique.`,
        path: filePath,
        count: occurrences,
      });
    }

    const startLine = content.slice(0, content.indexOf(oldString)).split('\n').length;
    const newContent = content.replace(oldString, newString);
    writeFileSync(filePath, newContent, 'utf-8');

    const oldLines = oldString.split('\n').length;
    const newLines = newString.split('\n').length;

    return JSON.stringify({
      path: filePath,
      relativePath: toRelativePath(filePath),
      action: 'modified',
      oldString,
      newString,
      startLine,
      oldContent: content,
      newContent,
      linesAdded: newLines,
      linesRemoved: oldLines,
    });
  },
});

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
