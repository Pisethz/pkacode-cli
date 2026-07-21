import { execSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { platform } from 'node:os';
import type { Config } from '../config.js';
import { registerTool } from './registry.js';

registerTool({
  name: 'glob_search',
  description: 'Search for files and directories matching a glob pattern. Uses ripgrep or find (cross-platform) to locate files by pattern, name, or extension.',
  inputSchema: {
    type: 'object',
    properties: {
      pattern: {
        type: 'string',
        description: 'Glob pattern to search for (e.g. "**/*.ts", "src/**/*.test.ts", "**/package.json")',
      },
    },
    required: ['pattern'],
  },
  execute: async (args: Record<string, unknown>, _config: Config) => {
    const pattern = String(args.pattern);
    const cwd = process.cwd();

    try {
      // Try ripgrep first (fastest), then find, then pure Node.js fallback
      const isWin = platform() === 'win32';
      const shellPath = isWin
        ? (process.env.ComSpec || 'cmd.exe')
        : '/bin/sh';
      const findCmd = isWin
        ? `dir /s /b "${pattern}" 2>nul`
        : `find "${cwd}" -name "${pattern.replace(/[*?[\]]/g, '*')}" -type f 2>/dev/null || echo "NO_RESULTS"`;
      const rgCmd = `rg --files --glob "${pattern}" 2>/dev/null || ${findCmd}`;

      const output = execSync(rgCmd, {
        cwd,
        timeout: 10000,
        encoding: 'utf-8',
        windowsHide: true,
        shell: shellPath,
        maxBuffer: 5 * 1024 * 1024,
      });

      const files = output
        .split('\n')
        .map(f => f.trim())
        .filter(f => f && f !== 'NO_RESULTS')
        // Normalize paths: strip cwd prefix from find output on Unix
        .map(f => isWin ? f : f.startsWith(cwd) ? f.slice(cwd.length + 1) : f)
        .slice(0, 200);

      if (files.length > 0) {
        return JSON.stringify({
          pattern,
          files,
          total: files.length,
        });
      }
    } catch {
      // Fall through to simpleGlob
    }

    // Pure Node.js fallback (cross-platform)
    const results = simpleGlob(cwd, pattern);
    return JSON.stringify({
      pattern,
      files: results.slice(0, 200),
      total: results.length,
    });
  },
});

function simpleGlob(root: string, pattern: string): string[] {
  const results: string[] = [];
  const stack = [root];
  const extMatch = pattern.includes('.') ? pattern.split('.').pop()?.replace('*', '') : null;

  while (stack.length > 0 && results.length < 500) {
    const dir = stack.pop()!;
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const fullPath = resolve(dir, entry);
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            if (!entry.startsWith('.') && entry !== 'node_modules') {
              stack.push(fullPath);
            }
          } else if (stat.isFile()) {
            if (extMatch) {
              if (entry.endsWith(extMatch)) {
                results.push(relative(root, fullPath));
              }
            } else if (entry.includes(pattern.replace(/[*?[\]]/g, '').replace(/\//g, ''))) {
              results.push(relative(root, fullPath));
            }
          }
        } catch {
          // Skip inaccessible files
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  return results;
}
