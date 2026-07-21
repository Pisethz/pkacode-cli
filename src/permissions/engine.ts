import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { resolve, relative, isAbsolute } from 'node:path';
import chalk from 'chalk';
import type { Config, ToolCategory } from '../config/types.js';
import { TOOL_CATEGORY_MAP, isHardDenyShell, isReadOnlyShell, modeAllowsTool } from './modes.js';
import { loadPermissionRules, matchRule } from './rules.js';

export interface RuntimePermissions {
  dangerouslySkipPermissions: boolean;
  workspaceDirs: string[];
  enabledTools: ToolCategory[];
  permissionMode: Config['permissionMode'];
}

let runtime: RuntimePermissions | null = null;

export function setRuntimePermissions(opts: RuntimePermissions): void {
  runtime = opts;
}

export function getRuntimePermissions(config: Config): RuntimePermissions {
  if (runtime) {
    return {
      ...runtime,
      // Always use the latest config mode — user may have changed it via /permissions
      permissionMode: config.permissionMode,
      enabledTools: config.enabledTools,
      workspaceDirs: [...new Set([...runtime.workspaceDirs, ...config.workspaceDirs, process.cwd()])],
    };
  }
  return {
    dangerouslySkipPermissions: false,
    workspaceDirs: [...config.workspaceDirs, process.cwd()],
    enabledTools: config.enabledTools,
    permissionMode: config.permissionMode,
  };
}

export type PermissionDecision = 'allow' | 'deny';

export async function checkToolPermission(
  toolName: string,
  args: Record<string, unknown>,
  config: Config
): Promise<PermissionDecision> {
  const rt = getRuntimePermissions(config);

  if (rt.dangerouslySkipPermissions || rt.permissionMode === 'yolo') {
    return 'allow';
  }

  const category = TOOL_CATEGORY_MAP[toolName];
  if (category && !rt.enabledTools.includes(category)) {
    console.log(chalk.red(`\n  Denied: tool category "${category}" is disabled (--tools).\n`));
    return 'deny';
  }

  // Workspace scope for file tools
  if (['write_file', 'edit_file', 'delete_file', 'read_file'].includes(toolName) && args.path) {
    const filePath = resolve(process.cwd(), String(args.path));
    if (!isPathAllowed(filePath, rt.workspaceDirs)) {
      console.log(chalk.red(`\n  Denied: path outside allowed dirs: ${filePath}\n`));
      console.log(chalk.dim(`  Allowed: ${rt.workspaceDirs.join(', ')}`));
      console.log(chalk.dim('  Use --add-dir <path> to grant access.\n'));
      return 'deny';
    }
  }

  const command = toolName === 'exec_command' ? String(args.command || '') : undefined;

  if (command && isHardDenyShell(command)) {
    const rules = loadPermissionRules();
    if (!matchRule(rules.allow, toolName, command)) {
      console.log(chalk.red(`\n  Hard-denied dangerous command: ${command}\n`));
      return 'deny';
    }
  }

  const rules = loadPermissionRules();
  if (matchRule(rules.deny, toolName, command)) {
    console.log(chalk.red(`\n  Denied by permissions.json: ${toolName}\n`));
    return 'deny';
  }

  if (command && isReadOnlyShell(command)) {
    return 'allow';
  }

  if (matchRule(rules.allow, toolName, command)) {
    return 'allow';
  }

  const modeDecision = modeAllowsTool(rt.permissionMode, toolName);
  if (modeDecision === 'allow') return 'allow';
  if (modeDecision === 'deny') {
    console.log(chalk.yellow(`\n  Blocked by permission mode "${rt.permissionMode}": ${toolName}\n`));
    return 'deny';
  }

  // ask
  return askUser(toolName, args);
}

function isPathAllowed(filePath: string, dirs: string[]): boolean {
  const resolved = resolve(filePath);
  return dirs.some(dir => {
    const root = resolve(dir);
    const rel = relative(root, resolved);
    return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
  });
}

async function askUser(toolName: string, args: Record<string, unknown>): Promise<PermissionDecision> {
  const summary =
    toolName === 'exec_command'
      ? String(args.command || '')
      : args.path
        ? `${toolName} ${args.path}`
        : toolName;

  console.log(chalk.yellow(`\n  Permission required: ${summary}`));
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(chalk.cyan('  Allow? [y/N] '));
    const ok = /^y(es)?$/i.test(answer.trim());
    if (!ok) console.log(chalk.dim('  Denied by user.\n'));
    return ok ? 'allow' : 'deny';
  } finally {
    rl.close();
  }
}
