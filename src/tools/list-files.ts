import { readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import type { Config } from '../config.js';
import { registerTool } from './registry.js';

registerTool({
  name: 'list_directory',
  description: 'List all files and directories in the specified directory. Returns separate arrays of file names and directory names.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Directory path to list (relative to current working directory). Defaults to current directory if not specified.',
      },
    },
  },
  execute: async (args: Record<string, unknown>, _config: Config) => {
    const dirPath = args.path ? resolve(process.cwd(), String(args.path)) : process.cwd();
    const entries = readdirSync(dirPath);

    const files: string[] = [];
    const directories: string[] = [];

    for (const entry of entries) {
      try {
        const fullPath = resolve(dirPath, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          directories.push(entry);
        } else {
          files.push(entry);
        }
      } catch {
        files.push(entry);
      }
    }

    const relPath = relative(process.cwd(), dirPath) || '.';
    return JSON.stringify({
      path: relPath,
      files,
      directories,
      totalFiles: files.length,
      totalDirectories: directories.length,
    });
  },
});
