/**
 * Master Genesis Bot Trigger - Feature Module
 *
 * Barrel export for the Master Trigger feature.
 */

// Types
export * from './types';

// Validation utilities
export {
  validateTriggerConfig,
  validateTriggerInput,
  sanitizeMessage,
  canConnectToTrigger,
  getDefaultTriggerConfig,
} from './lib/validation';

// Hooks
export { useMasterTrigger } from './hooks/useMasterTrigger';
export type { UseMasterTriggerResult } from './hooks/useMasterTrigger';

// Components (will be added)
// export { MasterTriggerNodeConfig } from './components/MasterTriggerNodeConfig';
