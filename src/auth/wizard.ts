import chalk from 'chalk';
import type { ProviderName } from '../config/types.js';
import { PROVIDER_NAMES, DEFAULT_MODELS } from '../config/types.js';
import { loadConfig, saveConfig } from '../config/store.js';
import { selectFromList } from '../ui/select.js';
import { loginProvider, isValidProvider } from '../auth/credentials.js';
import { fetchModelsForProvider, setProvider, setModel } from '../commands/models.js';

const PROVIDER_LABELS: Record<ProviderName, { label: string; description: string }> = {
  gemini: {
    label: 'Gemini (Google AI Studio)',
    description: 'FREE · no credit card · Flash models',
  },
  groq: {
    label: 'Groq',
    description: 'FREE · no credit card · fast Llama / Qwen',
  },
  openrouter: {
    label: 'OpenRouter',
    description: 'FREE models only · openrouter/free + :free',
  },
  openrouter2: {
    label: 'OpenRouter 2 (DeepSeek Flash)',
    description: 'FREE · DeepSeek V4 Flash via OpenRouter',
  },
};

const GEMINI_FALLBACK = [
  { value: 'gemini-2.0-flash', label: 'Flash 2.0', description: 'Best free default — vision' },
  { value: 'gemini-2.5-flash', label: 'Flash 2.5', description: 'Newer, smarter, 1M context' },
  { value: 'gemini-2.5-flash-lite', label: 'Flash-Lite 2.5', description: 'Lowest latency, highest quota' },
  { value: 'gemini-3.1-flash-lite', label: 'Flash-Lite 3.1', description: 'Newest, most cost-efficient' },
  { value: 'gemini-2.0-flash-lite', label: 'Flash-Lite 2.0', description: 'Lightweight, fast responses' },
];

const GROQ_FALLBACK = [
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', description: 'Strong general purpose' },
  { value: 'llama-3.1-70b-versatile', label: 'Llama 3.1 70B', description: 'Older but capable' },
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', description: 'Fastest, lightweight' },
  { value: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B', description: 'MoE — strong reasoning' },
  { value: 'gemma2-9b-it', label: 'Gemma 2 9B', description: 'Google — balanced & fast' },
  { value: 'qwen/qwen3-32b', label: 'Qwen3 32B', description: 'Coding & math focused' },
];

const OPENROUTER_FALLBACK = [
  { value: 'openrouter/free', label: 'Auto free router', description: 'Picks the best free model' },
  { value: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash', description: ':free — fast, vision' },
  { value: 'google/gemini-2.5-flash-exp:free', label: 'Gemini 2.5 Flash', description: ':free — newer, smarter' },
  { value: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B', description: ':free — strong general' },
  { value: 'meta-llama/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B', description: ':free — fast & light' },
  { value: 'mistralai/mistral-nemo:free', label: 'Mistral Nemo', description: ':free — balanced' },
  { value: 'qwen/qwen-2.5-coder-32b-instruct:free', label: 'Qwen 2.5 Coder 32B', description: ':free — coding' },
  { value: 'deepseek/deepseek-chat:free', label: 'DeepSeek V2 Chat', description: ':free — reasoning' },
  { value: 'microsoft/phi-3-medium:free', label: 'Phi-3 Medium', description: ':free — compact & capable' },
  { value: 'cohere/command-r:free', label: 'Command R', description: ':free — retrieval focused' },
];

const OPENROUTER2_FALLBACK = [
  { value: 'deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash', description: 'Latest — fastest DeepSeek' },
  { value: 'deepseek/deepseek-chat', label: 'DeepSeek Chat V3', description: 'Strong general reasoning' },
  { value: 'deepseek/deepseek-r1', label: 'DeepSeek R1', description: 'Advanced reasoning' },
];

function fallbackModels(provider: ProviderName): Array<{ value: string; label: string; description?: string }> {
  switch (provider) {
    case 'gemini': return GEMINI_FALLBACK;
    case 'groq': return GROQ_FALLBACK;
    case 'openrouter': return OPENROUTER_FALLBACK;
    case 'openrouter2': return OPENROUTER2_FALLBACK;
  }
}

/**
 * Free auth: Gemini / Groq / OpenRouter / OpenRouter 2.
 */
export async function runAuthLoginWizard(providerArg?: string, keyArg?: string): Promise<void> {
  let provider: ProviderName | null = null;

  if (providerArg && isValidProvider(providerArg)) {
    provider = providerArg;
  } else {
    console.log('');
    console.log(chalk.bold.green('  PKA is FREE — Gemini, Groq, OpenRouter, OpenRouter 2.'));
    console.log(chalk.dim('  No credit card required.\n'));

    const picked = await selectFromList(
      'Choose FREE AI provider',
      PROVIDER_NAMES.map(p => ({
        value: p,
        label: PROVIDER_LABELS[p].label,
        description: PROVIDER_LABELS[p].description,
      }))
    );
    if (!picked || !isValidProvider(picked)) {
      console.log(chalk.dim('\n  Cancelled.\n'));
      return;
    }
    provider = picked;
  }

  console.log(chalk.cyan(`\n  Provider: ${PROVIDER_LABELS[provider].label}\n`));

  if (keyArg) {
    await loginProvider(provider, keyArg);
    console.log(chalk.green(`  ✓ API key saved for ${provider}`));
  } else {
    switch (provider) {
      case 'gemini': {
        const { loginGeminiOAuth } = await import('../auth/oauth/gemini.js');
        await loginGeminiOAuth();
        break;
      }
      case 'groq':
      case 'openrouter': {
        const { loginFreeCompatProvider } = await import('../auth/oauth/free-compat.js');
        await loginFreeCompatProvider(provider);
        break;
      }
      case 'openrouter2': {
        const { openInBrowser } = await import('../auth/browser-login.js');
        const { createInterface } = await import('node:readline/promises');
        const { stdin: input, stdout: output } = await import('node:process');
        console.log(chalk.cyan('  Opening OpenRouter to create a free API key...'));
        openInBrowser('https://openrouter.ai/keys');
        console.log(chalk.dim('  1. Create a free account on OpenRouter'));
        console.log(chalk.dim('  2. Generate an API key'));
        console.log(chalk.dim('  3. Copy and paste it below\n'));
        const rl = createInterface({ input, output });
        try {
          const key = (await rl.question(chalk.cyan('  Paste your OpenRouter API key: '))).trim();
          if (key) {
            await loginProvider('openrouter2', key);
            console.log(chalk.green(`  ✓ API key saved for OpenRouter 2`));
          } else {
            console.log(chalk.yellow('  No key entered. You can run `pkacode auth login --provider openrouter2` later.'));
          }
        } finally {
          rl.close();
        }
        break;
      }
    }
  }

  setProvider(provider);
  await runModelPicker(provider);
}

export async function runModelPicker(provider?: ProviderName): Promise<void> {
  const config = loadConfig();
  const active = provider || config.provider;

  console.log(chalk.cyan(`\n  Loading ${active} free models…`));

  let live: string[] = [];
  try {
    live = await fetchModelsForProvider(active);
  } catch {
    live = [];
  }

  let items: Array<{ value: string; label: string; description?: string }>;

  if (live.length > 0) {
    const filtered =
      active === 'openrouter'
        ? live.filter(id => id.includes(':free') || id === 'openrouter/free' || id.endsWith('/free'))
        : live;
    items = (filtered.length ? filtered : live).slice(0, 40).map(id => ({
      value: id,
      label: id,
    }));
  } else {
    items = fallbackModels(active);
    console.log(chalk.dim(`  (Using known ${active} free models — live list unavailable)`));
  }

  const model = await selectFromList(`Choose ${active} model (free)`, items, {
    hint: '↑↓ navigate · Enter select · Esc skip',
  });

  if (!model) {
    const def = DEFAULT_MODELS[active];
    setModel(def);
    console.log(chalk.dim(`\n  Using default free model: ${def}\n`));
    return;
  }

  setModel(model);
  const cfg = loadConfig();
  cfg.provider = active;
  cfg.model = model;
  saveConfig(cfg);

  console.log(chalk.green(`\n  ✓ Active (FREE): ${active} / ${model}`));
  console.log(chalk.dim('  Start chatting with: pka\n'));
}
