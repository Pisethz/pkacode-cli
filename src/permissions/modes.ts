import type { PermissionMode, ToolCategory } from '../config/types.js';

export const PERMISSION_MODES: PermissionMode[] = ['default', 'auto-edit', 'plan', 'yolo'];

export const TOOL_CATEGORY_MAP: Record<string, ToolCategory> = {
  read_file: 'fs',
  write_file: 'fs',
  edit_file: 'fs',
  delete_file: 'fs',
  list_files: 'fs',
  glob_search: 'fs',
  exec_command: 'bash',
  ask_user: 'fs',
};

export const READ_ONLY_SHELL = [
  /^ls(\s|$)/i,
  /^dir(\s|$)/i,
  /^pwd(\s|$)/i,
  /^cat(\s|$)/i,
  /^type(\s|$)/i,
  /^git\s+(status|diff|log|show|branch|remote)(\s|$)/i,
  /^head(\s|$)/i,
  /^tail(\s|$)/i,
  /^echo(\s|$)/i,
  /^which(\s|$)/i,
  /^where(\s|$)/i,
];

export const HARD_DENY_SHELL = [
  // Unix dangerous commands
  /rm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?\//i,
  /rm\s+-rf\s+[\/\\]/i,
  /mkfs\.\w+/i,
  /dd\s+if=/i,
  /chmod\s+[0-7]{3,4}\s+\//i,
  /chown\s+.*\s+\//i,
  /:\(\)\s*\{\s*:\|:&\s*\};:/, // fork bomb

  // Windows dangerous commands
  /del\s+\/f\s+\/s/i,
  /rd\s+\/s\s+\/q/i,
  /rmdir\s+\/s\s+\/q/i,
  /format\s+[a-z]:/i,
  /diskpart/i,
  /reg\s+delete/i,
  /cipher\s+\/w:/i,

  // Git force push (Windows & Unix)
  /git\s+push\s+.*(--force|-f).*(\s+)(main|master)/i,
  /git\s+push\s+.*(\s+)(main|master).*--force/i,
];

export function isReadOnlyShell(command: string): boolean {
  const cmd = command.trim();
  return READ_ONLY_SHELL.some(re => re.test(cmd));
}

export function isHardDenyShell(command: string): boolean {
  return HARD_DENY_SHELL.some(re => re.test(command));
}

export function modeAllowsTool(mode: PermissionMode, toolName: string): 'allow' | 'ask' | 'deny' {
  if (mode === 'yolo') return 'allow';

  if (mode === 'plan') {
    if (['read_file', 'list_files', 'glob_search', 'ask_user'].includes(toolName)) return 'allow';
    return 'deny';
  }

  if (mode === 'auto-edit') {
    if (['write_file', 'edit_file', 'delete_file', 'read_file', 'list_files', 'glob_search', 'ask_user'].includes(toolName)) {
      return 'allow';
    }
    if (toolName === 'exec_command') return 'ask';
    return 'ask';
  }

  // default
  if (['read_file', 'list_files', 'glob_search', 'ask_user'].includes(toolName)) return 'allow';
  if (['write_file', 'edit_file', 'delete_file'].includes(toolName)) return 'ask';
  if (toolName === 'exec_command') return 'ask';
  return 'ask';
}
