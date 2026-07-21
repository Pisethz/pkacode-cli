import type { Message, ToolCall } from '../ai/provider.js';

export class ConversationManager {
  private history: Message[] = [];
  private turnCount = 0;
  private totalTokensUsed = { prompt: 0, completion: 0, total: 0 };
  private systemPrompt: string;
  private sessionId: string | null = null;
  private startTime = Date.now();

  constructor(systemPrompt: string) {
    this.systemPrompt = systemPrompt;
  }

  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  setSessionId(id: string | null): void {
    this.sessionId = id;
  }

  getHistory(): Message[] {
    return [...this.history];
  }

  loadHistory(messages: Message[], sessionId?: string): void {
    this.history = messages.filter(m => m.role !== 'system');
    this.turnCount = this.history.filter(m => m.role === 'user').length;
    if (sessionId) this.sessionId = sessionId;
  }

  getMessages(): Message[] {
    return [
      { role: 'system', content: this.systemPrompt },
      ...this.history,
    ];
  }

  addUserMessage(content: string): void {
    this.history.push({
      role: 'user',
      content,
    });
    this.turnCount++;
  }

  addAssistantMessage(content: string, toolCalls?: ToolCall[]): void {
    this.history.push({
      role: 'assistant',
      content: content || '',
      tool_calls: toolCalls,
    });
  }

  addToolResult(toolCallId: string, name: string, result: string): void {
    this.history.push({
      role: 'tool',
      content: result,
      tool_call_id: toolCallId,
      name,
    });
  }

  recordUsage(usage?: { promptTokens: number; completionTokens: number; totalTokens: number }): void {
    if (usage) {
      this.totalTokensUsed.prompt += usage.promptTokens;
      this.totalTokensUsed.completion += usage.completionTokens;
      this.totalTokensUsed.total += usage.totalTokens;
    }
  }

  getTokenUsage() {
    return { ...this.totalTokensUsed };
  }

  clear(): void {
    this.history = [];
    this.turnCount = 0;
    this.totalTokensUsed = { prompt: 0, completion: 0, total: 0 };
    this.startTime = Date.now();
  }

  getSessionElapsed(): string {
    const elapsed = Date.now() - this.startTime;
    const totalSec = Math.floor(elapsed / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  }

  getTurnCount(): number {
    return this.turnCount;
  }

  trimHistory(): void {
    if (this.history.length <= 20) return;
    const keepCount = 20;
    const toRemove = this.history.length - keepCount;
    if (toRemove > 0) {
      this.history.splice(0, toRemove);
    }
  }
}
