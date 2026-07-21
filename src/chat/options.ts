import type { SessionData } from '../sessions/store.js';
import type { RuntimePermissions } from '../permissions/engine.js';

export interface SessionOptions {
  /** Initial prompt for interactive or print mode */
  prompt?: string;
  /** Headless one-shot */
  print?: boolean;
  /** Resume session payload */
  resumeSession?: SessionData | null;
  /** Runtime permission overrides from CLI flags */
  runtime?: Partial<RuntimePermissions>;
}
