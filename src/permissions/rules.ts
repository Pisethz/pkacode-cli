import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { ensureConfigDirs, PERMISSIONS_PATH } from '../config/store.js';

export interface PermissionRules {
  allow: string[];
  ask: string[];
  deny: string[];
}

export function getDefaultPermissionRules(): PermissionRules {
  return {
    allow: [
      'read_file',
      'list_files',
      'glob_search',
      'ask_user',
      'shell:ls*',
      'shell:dir*',
      'shell:pwd*',
      'shell:git status*',
      'shell:git diff*',
      'shell:git log*',
    ],
    ask: ['write_file', 'edit_file', 'delete_file', 'exec_command', 'shell:*'],
    deny: [
      'shell:rm -rf /*',
      'shell:rm -rf /',
      'shell:mkfs*',
      'shell:format *',
      'shell:git push*--force*main*',
      'shell:git push*--force*master*',
    ],
  };
}

export function loadPermissionRules(): PermissionRules {
  ensureConfigDirs();
  try {
    if (existsSync(PERMISSIONS_PATH)) {
      const data = JSON.parse(readFileSync(PERMISSIONS_PATH, 'utf-8')) as PermissionRules;
      return {
        allow: data.allow || [],
        ask: data.ask || [],
        deny: data.deny || [],
      };
    }
  } catch {
    // fall through
  }
  const defaults = getDefaultPermissionRules();
  savePermissionRules(defaults);
  return defaults;
}

export function savePermissionRules(rules: PermissionRules): void {
  ensureConfigDirs();
  writeFileSync(PERMISSIONS_PATH, JSON.stringify(rules, null, 2));
}

export function matchRule(patterns: string[], toolName: string, command?: string): boolean {
  for (const pattern of patterns) {
    if (pattern.startsWith('shell:')) {
      if (toolName !== 'exec_command' || !command) continue;
      const glob = pattern.slice(6);
      if (globMatch(glob, command.trim())) return true;
      continue;
    }
    if (globMatch(pattern, toolName)) return true;
  }
  return false;
}

function globMatch(pattern: string, value: string): boolean {
  // Simple * wildcard matcher
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i').test(value);
}
