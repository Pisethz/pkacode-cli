import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { Message } from '../ai/provider.js';
import type { ProviderName } from '../config/types.js';
import { ensureConfigDirs, SESSIONS_DIR } from '../config/store.js';

export interface SessionMeta {
  id: string;
  provider: ProviderName | string;
  model: string;
  createdAt: string;
  updatedAt: string;
  preview: string;
}

export interface SessionData extends SessionMeta {
  messages: Message[];
  systemPrompt: string;
}

function sessionPath(id: string): string {
  return join(SESSIONS_DIR, `${id}.json`);
}

function makeId(): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${stamp}-${rand}`;
}

export function listSessions(): SessionMeta[] {
  ensureConfigDirs();
  if (!existsSync(SESSIONS_DIR)) return [];

  const files = readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
  const sessions: SessionMeta[] = [];

  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(join(SESSIONS_DIR, file), 'utf-8')) as SessionData;
      sessions.push({
        id: data.id,
        provider: data.provider,
        model: data.model,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        preview: data.preview,
      });
    } catch {
      // skip corrupt
    }
  }

  return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function loadSession(id: string): SessionData | null {
  ensureConfigDirs();
  const path = sessionPath(id);
  if (!existsSync(path)) {
    // try prefix match
    const all = listSessions();
    const match = all.find(s => s.id === id || s.id.startsWith(id));
    if (!match) return null;
    return JSON.parse(readFileSync(sessionPath(match.id), 'utf-8')) as SessionData;
  }
  return JSON.parse(readFileSync(path, 'utf-8')) as SessionData;
}

export function saveSession(input: {
  id?: string;
  provider: string;
  model: string;
  systemPrompt: string;
  messages: Message[];
}): SessionData {
  ensureConfigDirs();
  if (!existsSync(SESSIONS_DIR)) mkdirSync(SESSIONS_DIR, { recursive: true });

  const existing = input.id ? loadSession(input.id) : null;
  const id = existing?.id || input.id || makeId();
  const now = new Date().toISOString();
  const previewMsg = [...input.messages].reverse().find(m => m.role === 'user');
  const preview =
    typeof previewMsg?.content === 'string'
      ? previewMsg.content.slice(0, 80).replace(/\s+/g, ' ')
      : '(empty)';

  const data: SessionData = {
    id,
    provider: input.provider,
    model: input.model,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    preview,
    systemPrompt: input.systemPrompt,
    messages: input.messages,
  };

  writeFileSync(sessionPath(id), JSON.stringify(data, null, 2));
  return data;
}

export function clearSessions(): number {
  ensureConfigDirs();
  if (!existsSync(SESSIONS_DIR)) return 0;
  const files = readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    unlinkSync(join(SESSIONS_DIR, file));
  }
  return files.length;
}
