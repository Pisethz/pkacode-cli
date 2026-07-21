import type { Config } from '../config.js';
import { checkToolPermission } from '../permissions/engine.js';

// ── Tool Definition ─────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>, config: Config) => Promise<string>;
}

// ── Tool Registry ───────────────────────────────────────────

const tools = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition): void {
  tools.set(tool.name, tool);
}

export function getTool(name: string): ToolDefinition | undefined {
  return tools.get(name);
}

export function getAllTools(): ToolDefinition[] {
  return [...tools.values()];
}

export function getToolSchemas(): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> {
  return getAllTools().map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  config: Config
): Promise<string> {
  const tool = tools.get(name);
  if (!tool) {
    return `Error: Unknown tool "${name}". Available tools: ${[...tools.keys()].join(', ')}`;
  }

  try {
    const decision = await checkToolPermission(name, args, config);
    if (decision === 'deny') {
      return JSON.stringify({
        error: `Permission denied for tool "${name}".`,
        denied: true,
      });
    }

    return await tool.execute(args, config);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `Error executing tool "${name}": ${message}`;
  }
}
