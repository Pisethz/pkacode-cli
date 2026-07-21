import chalk from 'chalk';
import { loadConfig, saveConfig, getDefaultConfig, printConfig, resolveModelAlias } from '../config.js';
import type { Config } from '../config.js';
import { createProvider } from '../ai/provider.js';
import type { AIProvider } from '../ai/provider.js';
import { getApiKeyForProvider } from '../config/store.js';
import { getAllTools, executeToolCall } from '../tools/registry.js';
import { renderMarkdown, printDivider } from '../ui/markdown.js';
import { checkForUpdate, showUpdatePrompt } from '../ui/update-check.js';
import { startSpinner, stopSpinner, succeedSpinner, failSpinner } from '../ui/spinner.js';
import { getPromptInput, printStartupPanel, printHelp, drawInputBoxBottom, restoreTerminal, getMultilineInput, PROMPT_QUIT, type StatsInfo } from '../ui/prompt.js';
import { AIStatusDisplay } from '../ui/status-bar.js';
import { displayToolFileChange } from '../ui/diff.js';
import { ConversationManager } from './conversation.js';
import { saveSession, listSessions, loadSession, type SessionData } from '../sessions/store.js';
import { selectFromList } from '../ui/select.js';
import { setRuntimePermissions } from '../permissions/engine.js';
import type { SessionOptions } from './options.js';
import { isValidProvider } from '../auth/credentials.js';
import { setProvider, setModel, fetchModelsForProvider } from '../commands/models.js';
import { runPermissions } from '../commands/permissions.js';
import { runSandbox } from '../commands/sandbox.js';
import { printAllPkaCommands } from '../commands/catalog.js';
import { dispatchPkaCommand } from '../commands/dispatch.js';
import { PROVIDER_NAMES } from '../config/types.js';
import type { ProviderName } from '../config/types.js';
import { runAuthLoginWizard } from '../auth/wizard.js';
import { printUsageLimit } from '../ui/usage-limit.js';

// Import tools to register them (side-effect imports)
import '../tools/read-file.js';
import '../tools/write-file.js';
import '../tools/edit-file.js';
import '../tools/exec-command.js';
import '../tools/glob-search.js';
import '../tools/ask-user.js';
import '../tools/list-files.js';
import '../tools/delete-file.js';

// Import AI providers to register them (side-effect imports)
import '../ai/gemini.js';
import '../ai/groq.js';
import '../ai/openrouter.js';
import '../ai/openrouter2.js';
import { checkInstantMode, InstantProvider } from '../ai/instant.js';

// Track the current AbortController so Ctrl+C can cancel AI requests
let currentAbortController: AbortController | null = null;

/** Restore TTY and terminate the process (closes the CLI). */
function exitCliClean(message = 'Goodbye!'): never {
  restoreTerminal();
  console.log(chalk.dim(`\n  ${message}\n`));
  process.exit(0);
}

export function cancelCurrentRequest(): void {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }
}

export async function startInteractiveSession(
  options: SessionOptions | string = {}
): Promise<void> {
  // Backward compat: string arg was single prompt
  const opts: SessionOptions =
    typeof options === 'string' ? { prompt: options } : options;

  let config = loadConfig();
  config.model = resolveModelAlias(config, config.model);

  // Check instant mode availability
  const hasKey = Boolean(getApiKeyForProvider(config, config.provider));
  if (!hasKey) {
    instantModeInfo = await checkInstantMode();
  }

  // Apply runtime permission overrides from CLI flags
  if (opts.runtime) {
    setRuntimePermissions({
      dangerouslySkipPermissions: Boolean(opts.runtime.dangerouslySkipPermissions),
      workspaceDirs: [
        ...config.workspaceDirs,
        process.cwd(),
        ...(opts.runtime.workspaceDirs || []),
      ],
      enabledTools: opts.runtime.enabledTools || config.enabledTools,
      permissionMode: opts.runtime.permissionMode || config.permissionMode,
    });

    if (opts.runtime.permissionMode) {
      config.permissionMode = opts.runtime.permissionMode;
    }
    if (opts.runtime.enabledTools) {
      config.enabledTools = opts.runtime.enabledTools;
    }
    if (opts.runtime.workspaceDirs?.length) {
      config.workspaceDirs = [
        ...new Set([...config.workspaceDirs, ...opts.runtime.workspaceDirs]),
      ];
    }
  }

  let activeProvider = getProvider(config);
  let conversation = new ConversationManager(config.systemPrompt);

  if (opts.resumeSession) {
    conversation.loadHistory(opts.resumeSession.messages, opts.resumeSession.id);
    console.log(chalk.dim(`  Loaded ${conversation.getTurnCount()} turn(s) from session.\n`));
  }

  const isPrint = Boolean(opts.print);

  if (!isPrint) {
    process.stdout.write('\x1b[2J\x1b[H');
  }

  if (!opts.prompt && !isPrint) {
    const modeText = hasKey
      ? chalk.green('Unlimited')
      : instantModeInfo?.available
        ? chalk.cyan(`Instant (${instantModeInfo.remaining}/${instantModeInfo.limit})`)
        : chalk.red('No key');
    printStartupPanel(config.model, modeText);

    const info = await checkForUpdate();
    await showUpdatePrompt(info, process.stdin);
  }

  // Set up SIGINT handler for cancellation / quit
  const sigintHandler = () => {
    if (currentAbortController) {
      cancelCurrentRequest();
      restoreTerminal();
      console.log(chalk.yellow('\n  (Cancelled — Ctrl+C again to quit)'));
      if (!isPrint) drawInputBoxBottom(config.model);
      return;
    }
    exitCliClean('Goodbye!');
  };

  process.on('SIGINT', sigintHandler);

  try {
    if (opts.prompt) {
      await processUserInput(opts.prompt, activeProvider, config, conversation);
      persistSession(config, conversation);
      if (isPrint) return;
      // Otherwise continue into interactive loop
    }

    if (isPrint) return;

    // Interactive loop
    while (true) {
      try {
        const usage = conversation.getTokenUsage();
        const stats: StatsInfo = {
          promptTokens: usage.prompt,
          completionTokens: usage.completion,
          maxTokens: config.maxTokens,
          getSessionTime: () => conversation.getSessionElapsed(),
        };
        const input = await getPromptInput(config.model, stats);

        if (input === PROMPT_QUIT) {
          exitCliClean('Goodbye!');
        }

        if (input === null) continue;

        // Handle commands
        if (input.startsWith('/')) {
          const result = await handleCommand(input, config, conversation);

          if (result === 'exit') {
            exitCliClean('Goodbye! Happy coding!');
          }

          if (typeof result === 'object' && result.prompt) {
            await processUserInput(result.prompt, activeProvider, config, conversation);
            persistSession(config, conversation);
            continue;
          }

          // Recreate provider if model was changed
          if (result === 'reload-provider') {
            activeProvider = getProvider(config);
          }

          // Conversation was recreated inside handler if reset
          if (result === 'reset-done') {
            conversation = new ConversationManager(config.systemPrompt);
          }

          continue;
        }

        // Process user input
        await processUserInput(input, activeProvider, config, conversation);
        persistSession(config, conversation);

      } catch (error: unknown) {
        if (error instanceof Error) {
          if (isAbortError(error)) {
            // Cancel during AI — stay in session; Ctrl+C at prompt quits
            continue;
          }
          if (!printUsageLimit(error, config.model)) {
            console.error(chalk.red(`\n  Error: ${error.message}`));
          }
        } else {
          console.error(chalk.red(`\n  Error: ${String(error)}`));
        }
      }
    }
  } finally {
    restoreTerminal();
    process.off('SIGINT', sigintHandler);
  }
}

function persistSession(config: Config, conversation: ConversationManager): void {
  try {
    const saved = saveSession({
      id: conversation.getSessionId() || undefined,
      provider: config.provider,
      model: config.model,
      systemPrompt: conversation.getSystemPrompt(),
      messages: conversation.getHistory(),
    });
    conversation.setSessionId(saved.id);
  } catch {
    // non-fatal
  }
}

async function processUserInput(
  input: string,
  provider: AIProvider,
  config: Config,
  conversation: ConversationManager
): Promise<void> {
  conversation.addUserMessage(input);

  const status = new AIStatusDisplay(config.model);
  status.start('thinking');

  // Main AI loop with tool execution
  const maxIterations = 10;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations++;

    if (iterations > 1) {
      status.setActivity('thinking');
    }

    try {
      const messages = conversation.getMessages();
      const tools = getAllTools();

      // Create a new AbortController for this request
      currentAbortController = new AbortController();
      const signal = currentAbortController.signal;

      let accumulatedContent = '';
      let requestCancelled = false;

      const result = await provider.chat({
        messages,
        tools,
        signal,
        onStreamReasoning: (chunk: string) => {
          status.appendThinking(chunk);
        },
        onUsage: (usage) => {
          status.setTokens(usage);
        },
        onStream: (chunk: string) => {
          if (!accumulatedContent) {
            status.closeThinking();
            status.setActivity('streaming');
          }
          accumulatedContent += chunk;
        },
      }).catch((error: unknown) => {
        if (isAbortError(error)) {
          requestCancelled = true;
          return null;
        }
        throw error;
      });

      // End AI response — render buffered content
      if (accumulatedContent) {
        process.stdout.write('\n');
        renderMarkdown(accumulatedContent);
        status.trackNewline();
      }

      currentAbortController = null;

      if (requestCancelled || !result) {
        status.stop();
        return;
      }

      // Record usage and trim history periodically
      conversation.recordUsage(result.usage);
      if (result.usage) {
        status.setTokens({
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
        });
      }
      if (iterations % 3 === 0) {
        conversation.trimHistory();
      }

      // Handle tool calls
      if (result.toolCalls && result.toolCalls.length > 0) {
        status.closeThinking();
        if (accumulatedContent) {
          process.stdout.write('\n');
          printDivider();
          status.trackNewline(2);
        }

        conversation.addAssistantMessage(result.content, result.toolCalls);

        for (const toolCall of result.toolCalls) {
          const toolName = toolCall.function.name;
          let toolArgs: Record<string, unknown>;

          try {
            toolArgs = JSON.parse(toolCall.function.arguments);
          } catch {
            toolArgs = { raw: toolCall.function.arguments };
          }

          status.setActivity('tool');
          const toolSpinner = startSpinner(`\u{1F527} Using ${toolName}...`);

          try {
            const toolResult = await executeToolCall(toolName, toolArgs, config);
            succeedSpinner(toolSpinner, chalk.dim(`\u{2713} ${toolName}`));
            status.trackNewline();
            if (displayToolFileChange(toolName, toolResult)) {
              status.trackNewline();
            }
            conversation.addToolResult(toolCall.id, toolName, toolResult);
          } catch (error: unknown) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            failSpinner(toolSpinner, chalk.dim(`\u{2717} ${toolName}: ${errorMsg}`));
            status.trackNewline();
            conversation.addToolResult(
              toolCall.id,
              toolName,
              JSON.stringify({ error: errorMsg })
            );
          }
        }

        conversation.trimHistory();
        continue;
      }

      // No tool calls — just text response
      if (accumulatedContent) {
        status.trackNewline();
        conversation.addAssistantMessage(accumulatedContent);
      } else {
        status.setActivity('streaming');
        if (result.content) {
          process.stdout.write('\n');
          status.trackNewline();
          renderMarkdown(result.content);
          process.stdout.write('\n');
          status.trackNewline(2);
          conversation.addAssistantMessage(result.content);
        } else {
          console.log(chalk.dim('  (empty response)'));
          status.trackNewline();
        }
      }

      status.stop();
      break;
    } catch (error: unknown) {
      status.stop();
      currentAbortController = null;
      if (error instanceof Error && !isAbortError(error)) {
        if (!printUsageLimit(error, config.model)) {
          console.error(chalk.red(`\n  Error: ${error.message}`));
        }
      }
      break;
    }
  }

  if (iterations >= maxIterations) {
    status.stop();
    console.log(chalk.yellow('\n  (Reached iteration limit. Continuing in a new turn.)'));
  }
}

type CommandResult =
  | 'exit'
  | 'handled'
  | 'reload-provider'
  | 'reset-done'
  | { prompt: string };

async function handleCommand(
  input: string,
  config: Config,
  conversation: ConversationManager
): Promise<CommandResult> {
  const parts = input.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  // Full PKA CLI from chat: /pka auth login · /pka models list --provider gemini · …
  if (cmd === '/pka') {
    const result = await dispatchPkaCommand(parts);
    if (result === 'exit') return 'exit';
    if (result === 'reload-provider') {
      Object.assign(config, loadConfig());
      return 'reload-provider';
    }
    if (typeof result === 'object' && 'resumeSessionId' in result) {
      const session = loadSession(result.resumeSessionId);
      if (session) {
        conversation.loadHistory(session.messages, session.id);
        console.log(chalk.green(`\n  ✓ Resumed ${session.id}\n`));
      }
      return 'handled';
    }
    Object.assign(config, loadConfig());
    return 'handled';
  }

  switch (cmd) {
    case '/exit':
    case '/quit':
      return 'exit';

    case '/clear':
      conversation.clear();
      console.log(chalk.dim('\n  Conversation cleared.\n'));
      return 'handled';

    case '/help':
      printHelp();
      return 'handled';

    case '/commands':
      printAllPkaCommands();
      return 'handled';

    case '/auth':
      // Shortcut → full login wizard (provider → browser → model)
      await runAuthLoginWizard(args[0], args[1]);
      Object.assign(config, loadConfig());
      return 'reload-provider';

    case '/provider':
      if (args.length > 0) {
        const name = args[0].toLowerCase();
        if (!isValidProvider(name)) {
          console.log(chalk.red(`\n  Unknown provider. Use: ${PROVIDER_NAMES.join(', ')}\n`));
          return 'handled';
        }
        setProvider(name as ProviderName);
        Object.assign(config, loadConfig());
        console.log(chalk.green(`\n  ✓ Provider set to ${name} (model: ${config.model})\n`));
        return 'reload-provider';
      }
      // No args → interactive wizard
      await runAuthLoginWizard();
      Object.assign(config, loadConfig());
      return 'reload-provider';

    case '/model':
      if (args.length > 0) {
        const name = args.join(' ');
        setModel(name);
        config.model = loadConfig().model;
        console.log(chalk.green(`\n  Switched to model: ${config.model}\n`));
        return 'reload-provider';
      }
      console.log(chalk.dim(`\n  Current model: ${config.model}\n`));
      return 'handled';

    case '/models': {
      // Interactive list or live fetch
      if (args[0] === 'pick') {
        const { runModelPicker } = await import('../auth/wizard.js');
        await runModelPicker();
        Object.assign(config, loadConfig());
        return 'reload-provider';
      }
      const filter = args[0] && isValidProvider(args[0]) ? (args[0] as ProviderName) : undefined;
      try {
        if (filter) {
          const spinner = startSpinner(`Fetching ${filter} models...`);
          const models = await fetchModelsForProvider(filter);
          stopSpinner(spinner);
          console.log(chalk.bold.cyan(`\n  ${filter} Models:`));
          for (const m of models) {
            const marker = m === config.model ? chalk.green(' ◈') : '  ';
            console.log(`   ${marker} ${m}`);
          }
          console.log('');
        } else {
          const spinner = startSpinner('Fetching available models...');
          const models = await createProvider(config).listModels?.() || [];
          stopSpinner(spinner);
          if (models.length > 0) {
            console.log(chalk.bold.cyan('\n  Available Models:'));
            for (const m of models) {
              const marker = m === config.model ? chalk.green(' ◈') : '  ';
              console.log(`   ${marker} ${m}`);
            }
            console.log('');
          } else {
            console.log(chalk.yellow('\n  Could not fetch models. Try: /models gemini|groq|openrouter'));
            console.log(chalk.dim('  Or: /pka auth login  then  /models pick\n'));
          }
        }
      } catch {
        console.log(chalk.yellow('\n  Could not fetch models.\n'));
      }
      return 'handled';
    }

    case '/sessions': {
      const sessions = listSessions();
      if (sessions.length === 0) {
        console.log(chalk.dim('\n  No saved sessions.\n'));
      } else {
        console.log(chalk.bold.cyan('\n  Saved Sessions\n'));
        for (const s of sessions) {
          console.log(`  ${chalk.green(s.id)}`);
          console.log(chalk.dim(`    ${s.provider}/${s.model}  ·  ${s.updatedAt}`));
          console.log(chalk.dim(`    ${s.preview}\n`));
        }
      }
      return 'handled';
    }

    case '/resume': {
      // Load session by ID or interactive picker
      let resumeSession: SessionData | null = null;

      if (args[0]) {
        resumeSession = loadSession(args[0]);
        if (!resumeSession) {
          console.log(chalk.red(`\n  Session not found: ${args[0]}\n`));
          return 'handled';
        }
      } else {
        // Interactive picker — list sessions and let user choose
        const sessionList = listSessions();
        if (sessionList.length === 0) {
          console.log(chalk.dim('\n  No saved sessions.\n'));
          return 'handled';
        }

        const items = sessionList.map(s => ({
          value: s.id,
          label: s.id.slice(-12),
          description: `${s.provider}/${s.model} \u00b7 ${s.preview.slice(0, 50)}`,
        }));

        const selected = await selectFromList(
          'Select Session to Resume',
          items,
          { hint: '\u2191\u2193 navigate \u00b7 Enter resume \u00b7 Esc cancel' }
        );

        if (!selected) {
          console.log(chalk.dim('\n  Resume cancelled.\n'));
          return 'handled';
        }

        resumeSession = loadSession(selected);
        if (!resumeSession) {
          console.log(chalk.red(`\n  Session not found: ${selected}\n`));
          return 'handled';
        }
      }

      // Load history into conversation
      conversation.loadHistory(resumeSession.messages, resumeSession.id);
      const turnCount = conversation.getTurnCount();
      console.log(chalk.green(`\n  \u2713 Resumed ${resumeSession.id} (${turnCount} turns)\n`));

      // Display previous conversation so user can see it
      console.log(chalk.bold.cyan('  \u2501 Previous Conversation \u2501\n'));
      for (const msg of resumeSession.messages) {
        if (msg.role === 'system' || msg.role === 'tool') continue;

        if (msg.role === 'user') {
          process.stdout.write(chalk.green('\n  \u25b6 You:\n'));
          if (typeof msg.content === 'string') {
            process.stdout.write(`  ${msg.content}\n`);
          }
        } else if (msg.role === 'assistant') {
          process.stdout.write(chalk.cyan('  \u25b6 PKA:\n'));
          if (typeof msg.content === 'string' && msg.content) {
            renderMarkdown(msg.content);
          }
        }
      }
      console.log(chalk.bold.cyan('\n  \u2501 End of Previous Conversation \u2501\n'));

      return 'handled';
    }

    case '/session':
    case '/info': {
      const sid = conversation.getSessionId();
      const usage = conversation.getTokenUsage();
      const turns = conversation.getTurnCount();
      console.log(chalk.bold.cyan('\n  \u2501\u2501 Session Info \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501'));
      console.log(`  ID:       ${chalk.white(sid || 'new')}`);
      console.log(`  Model:    ${chalk.yellow(config.model)}`);
      console.log(`  Provider: ${chalk.yellow(config.provider)}`);
      console.log(`  Turns:    ${chalk.yellow(String(turns))}`);
      console.log(`  Tokens:   ${chalk.yellow(usage.total.toLocaleString())}  (prompt: ${usage.prompt.toLocaleString()} / completion: ${usage.completion.toLocaleString()})`);
      console.log('');
      return 'handled';
    }

    case '/new': {
      // Save current conversation before creating a new session
      persistSession(config, conversation);
      conversation.clear();
      conversation.setSessionId(null);
      console.log(chalk.green('\n  \u2713 New session started. Previous session saved.\n'));
      return 'handled';
    }

    case '/tokens': {
      const usage = conversation.getTokenUsage();
      console.log(chalk.dim('\n  Token Usage (this session):'));
      console.log(chalk.dim(`    Prompt:     ${usage.prompt.toLocaleString()}`));
      console.log(chalk.dim(`    Completion: ${usage.completion.toLocaleString()}`));
      console.log(chalk.dim(`    Total:      ${usage.total.toLocaleString()}`));
      console.log(chalk.dim(`    Turns:      ${conversation.getTurnCount()}`));
      console.log('');
      return 'handled';
    }

    case '/config':
      printConfig(config);
      return 'handled';

    case '/permissions':
    case '/perm':
      const permResult = await runPermissions();
      if (permResult === 'reload-provider') {
        Object.assign(config, loadConfig());
        return 'reload-provider';
      }
      return 'handled';

    case '/sandbox':
      runSandbox(args[0]);
      Object.assign(config, loadConfig());
      return 'handled';

    case '/multiline': {
      console.log(chalk.dim('\n  Multi-line mode — blank line or /send to finish.\n'));
      const text = await getMultilineInput();
      if (text.trim()) {
        return { prompt: text.trim() };
      }
      return 'handled';
    }

    case '/reset': {
      const newConfig = getDefaultConfig();
      saveConfig(newConfig);
      Object.assign(config, newConfig);
      console.log(chalk.green('\n  Configuration reset to defaults.\n'));
      return 'reset-done';
    }

    default:
      console.log(chalk.yellow(`\n  Unknown command: ${cmd}`));
      console.log(chalk.green('  FREE-only: Gemini · Groq · OpenRouter'));
      console.log(chalk.dim('  Type / for popup, /pka auth login to connect a free provider, or /commands.\n'));
      return 'handled';
  }
}

let instantModeInfo: { available: boolean; remaining: number; limit: number } | null = null;

function getProvider(config: Config): AIProvider {
  const key = getApiKeyForProvider(config, config.provider);
  if (!key) {
    // No key — try instant mode via local server
    if (instantModeInfo?.available) {
      return new InstantProvider(config);
    }
    console.error(chalk.red(`\n  No API key for ${config.provider}.`));
    console.log(chalk.dim(`  Options:`));
    console.log(chalk.dim(`    1. Run 'pkacode auth login' to add your own key (unlimited)`));
    console.log(chalk.dim(`    2. Run 'pkacodeweb' to start server for instant mode\n`));
    process.exit(1);
  }
  try {
    return createProvider(config);
  } catch (error) {
    console.error(chalk.red(`Error creating provider: ${error}`));
    process.exit(1);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error &&
    (error.name === 'AbortError' || error.message === 'The operation was aborted' || error.message.includes('abort'));
}
