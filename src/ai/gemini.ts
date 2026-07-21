import type { Config } from '../config/types.js';
import type {
  AIProvider,
  ChatCompletionOptions,
  ChatCompletionResult,
  Message,
  ToolCall,
} from './provider.js';
import { registerProvider } from './provider.js';
import { getApiKeyForProvider } from '../config/store.js';
import { getValidGeminiAccessToken, isGeminiOAuthBearer } from '../auth/oauth/gemini.js';

// ── Gemini API types ────────────────────────────────────────

type GeminiRole = 'user' | 'model';

interface GeminiPart {
  text?: string;
  functionCall?: {
    name: string;
    args: Record<string, unknown>;
  };
  functionResponse?: {
    name: string;
    response: Record<string, unknown>;
  };
}

interface GeminiContent {
  role: GeminiRole;
  parts: GeminiPart[];
}

interface GeminiTool {
  functionDeclarations: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
}

interface GeminiRequest {
  contents: GeminiContent[];
  systemInstruction?: { parts: [{ text: string }] };
  tools?: GeminiTool[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    stopSequences?: string[];
  };
}

interface GeminiResponseCandidate {
  index: number;
  content: GeminiContent;
  finishReason: string;
}

interface GeminiResponse {
  candidates: GeminiResponseCandidate[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

// ── Provider ────────────────────────────────────────────────

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  private baseUrl: string;
  private config: Config;
  private modelName: string;

  constructor(config: Config) {
    this.config = config;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    // Auto-default model if not set or if it's not a valid Gemini model name
    const requestedModel = config.model || '';
    if (!requestedModel.startsWith('gemini-')) {
      this.modelName = 'gemini-2.0-flash';
    } else {
      this.modelName = requestedModel;
    }
  }

  // ── Message conversion ────────────────────────────────────

  private convertMessages(messages: Message[]): {
    contents: GeminiContent[];
    systemPrompt: string | null;
  } {
    const contents: GeminiContent[] = [];
    let systemPrompt: string | null = null;

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt = typeof msg.content === 'string' ? msg.content : '';
        continue;
      }

      if (msg.role === 'user') {
        const parts: GeminiPart[] = [];

        if (typeof msg.content === 'string') {
          parts.push({ text: msg.content });
        } else if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part.type === 'text') {
              parts.push({ text: part.text });
            }
          }
        }

        contents.push({ role: 'user', parts });
      }

      if (msg.role === 'assistant') {
        const parts: GeminiPart[] = [];

        if (typeof msg.content === 'string' && msg.content) {
          parts.push({ text: msg.content });
        }

        // Add tool calls as functionCall parts
        if (msg.tool_calls) {
          for (const tc of msg.tool_calls) {
            parts.push({
              functionCall: {
                name: tc.function.name,
                args: JSON.parse(tc.function.arguments),
              },
            });
          }
        }

        contents.push({ role: 'model', parts });
      }

      if (msg.role === 'tool') {
        // Find the last model message to attach function response
        const name = msg.name || 'unknown';
        let responseContent: Record<string, unknown>;
        try {
          responseContent = JSON.parse(
            typeof msg.content === 'string' ? msg.content : '{}'
          );
        } catch {
          responseContent = { result: String(msg.content) };
        }

        // Add as a function response from the user role
        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name,
                response: responseContent,
              },
            },
          ],
        });
      }
    }

    return { contents, systemPrompt };
  }

  private convertTools(tools: ChatCompletionOptions['tools']): GeminiTool[] | undefined {
    if (!tools || tools.length === 0) return undefined;

    return [
      {
        functionDeclarations: tools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.inputSchema as Record<string, unknown>,
        })),
      },
    ];
  }

  // ── Extract ToolCalls from Gemini response ────────────────

  private extractToolCalls(content: GeminiContent): ToolCall[] | undefined {
    const toolCalls: ToolCall[] = [];
    let idx = 0;

    for (const part of content.parts) {
      if (part.functionCall) {
        toolCalls.push({
          id: `call_${idx}`,
          type: 'function',
          function: {
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args),
          },
        });
        idx++;
      }
    }

    return toolCalls.length > 0 ? toolCalls : undefined;
  }

  private extractText(content: GeminiContent): string {
    return content.parts
      .filter(p => p.text)
      .map(p => p.text)
      .join('');
  }

  // ── Chat ──────────────────────────────────────────────────

  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const { contents, systemPrompt } = this.convertMessages(options.messages);

    const body: GeminiRequest = {
      contents,
      generationConfig: {
        temperature: this.config.temperature,
        maxOutputTokens: this.config.maxTokens,
      },
    };

    if (systemPrompt) {
      body.systemInstruction = { parts: [{ text: systemPrompt }] };
    }

    const tools = this.convertTools(options.tools);
    if (tools) body.tools = tools;

    const auth = await this.getAuth();
    const model = this.modelName;

    if (options.onStream) {
      return this.streamChat(model, auth, body, options);
    } else {
      return this.nonStreamChat(model, auth, body);
    }
  }

  private async getAuth(): Promise<{ mode: 'key' | 'bearer'; value: string }> {
    const oauth = await getValidGeminiAccessToken();
    if (oauth && isGeminiOAuthBearer(oauth)) {
      return { mode: 'bearer', value: oauth };
    }
    const key =
      (oauth && oauth.startsWith('AIza') ? oauth : '') ||
      getApiKeyForProvider(this.config, 'gemini') ||
      this.config.geminiApiKey ||
      this.config.apiKey ||
      '';
    if (!key) {
      throw new Error('Gemini not logged in. Run: /pka auth login');
    }
    return { mode: 'key', value: key };
  }

  private authHeaders(auth: { mode: 'key' | 'bearer'; value: string }): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (auth.mode === 'bearer') headers.Authorization = `Bearer ${auth.value}`;
    return headers;
  }

  private async nonStreamChat(
    model: string,
    auth: { mode: 'key' | 'bearer'; value: string },
    body: GeminiRequest
  ): Promise<ChatCompletionResult> {
    const url =
      auth.mode === 'key'
        ? `${this.baseUrl}/models/${model}:generateContent?key=${auth.value}`
        : `${this.baseUrl}/models/${model}:generateContent`;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.authHeaders(auth),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `Gemini API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`
      );
    }

    const data = (await response.json()) as GeminiResponse;
    return this.parseResponse(data);
  }

  private async streamChat(
    model: string,
    auth: { mode: 'key' | 'bearer'; value: string },
    body: GeminiRequest,
    options: ChatCompletionOptions
  ): Promise<ChatCompletionResult> {
    const url =
      auth.mode === 'key'
        ? `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${auth.value}`
        : `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse`;

    const response = await fetch(url, {
      method: 'POST',
      headers: this.authHeaders(auth),
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(
        `Gemini API error: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`
      );
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullText = '';
    let finalToolCalls: ToolCall[] | undefined;
    let promptTokens = 0;
    let completionTokens = 0;
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Gemini SSE format: `data: {...}\n\n`
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          for (const line of part.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const jsonStr = trimmed.slice(6).trim();
            if (!jsonStr || jsonStr === '[DONE]') continue;

            try {
              const chunk = JSON.parse(jsonStr) as GeminiResponse;
              const candidate = chunk.candidates?.[0];

              if (candidate?.content) {
                const text = this.extractText(candidate.content);
                if (text) {
                  fullText += text;
                  options.onStream?.(text);
                }

                const tcs = this.extractToolCalls(candidate.content);
                if (tcs) {
                  finalToolCalls = tcs;
                }
              }

              if (chunk.usageMetadata) {
                promptTokens = chunk.usageMetadata.promptTokenCount;
                completionTokens = chunk.usageMetadata.candidatesTokenCount;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      content: fullText,
      toolCalls: finalToolCalls,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }

  private parseResponse(data: GeminiResponse): ChatCompletionResult {
    const candidate = data.candidates?.[0];
    if (!candidate) {
      return { content: '', usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 } };
    }

    const content = this.extractText(candidate.content);
    const toolCalls = this.extractToolCalls(candidate.content);

    return {
      content,
      toolCalls,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      },
    };
  }

  async listModels(): Promise<string[]> {
    try {
      const auth = await this.getAuth();
      const url =
        auth.mode === 'key'
          ? `${this.baseUrl}/models?key=${auth.value}`
          : `${this.baseUrl}/models`;
      const response = await fetch(url, { headers: this.authHeaders(auth) });
      if (!response.ok) return [];

      const data = (await response.json()) as {
        models: Array<{ name: string; supportedGenerationMethods: string[] }>;
      };

      return data.models
        ?.filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => m.name.replace('models/', '')) || [];
    } catch {
      return [];
    }
  }
}

registerProvider('gemini', GeminiProvider);
