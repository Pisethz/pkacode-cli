/**
 * Backward-compatible re-exports. Prefer importing from './config/store.js' or './config/types.js'.
 */
export type { Config, ProviderName, PermissionMode, ToolCategory, ProviderApiKeys } from './config/types.js';
export {
  loadConfig,
  saveConfig,
  getDefaultConfig,
  printConfig,
  getConfigPath,
  getConfigDir,
  resolveModelAlias,
  getApiKeyForProvider,
  ensureConfigDirs,
  PKA_CONFIG_DIR,
  MODELS_CACHE_PATH,
  PERMISSIONS_PATH,
  SESSIONS_DIR,
} from './config/store.js';
export {
  PROVIDER_NAMES,
  DEFAULT_MODELS,
  DEFAULT_API_BASES,
  emptyApiKeys,
} from './config/types.js';
