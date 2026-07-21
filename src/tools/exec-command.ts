import { execa } from 'execa';
import type { Config } from '../config.js';
import { registerTool } from './registry.js';

registerTool({
  name: 'exec_command',
  description: 'Execute a terminal command in the user\'s current working directory. Use this to run build commands, tests, linters, git operations, or any other shell command. Returns stdout, stderr, and the exit code.',
  inputSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute',
      },
      description: {
        type: 'string',
        description: 'A brief description of what this command does (for the user\'s clarity)',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds. Default: 30000 (30 seconds)',
      },
    },
    required: ['command'],
  },
  execute: async (args: Record<string, unknown>, _config: Config) => {
    const command = String(args.command);
    const timeout = (args.timeout as number) || 30000;
    const description = String(args.description || command);

    try {
      const result = await execa(command, {
        cwd: process.cwd(),
        timeout,
        shell: true,
        windowsHide: true,
        reject: false,
        maxBuffer: 10 * 1024 * 1024,
      });

      return JSON.stringify({
        command: description,
        exitCode: result.exitCode ?? 0,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        signal: result.signal || null,
      });
    } catch (error: unknown) {
      const err = error as { exitCode?: number; stdout?: string; stderr?: string; message?: string; signal?: string };
      return JSON.stringify({
        command: description,
        exitCode: err.exitCode || 1,
        stdout: err.stdout || '',
        stderr: err.stderr || err.message || 'Command failed',
        signal: err.signal || null,
      });
    }
  },
});
