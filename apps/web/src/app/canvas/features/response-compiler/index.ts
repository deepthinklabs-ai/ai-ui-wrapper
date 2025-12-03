/**
 * Response Compiler Feature Module
 *
 * Collects and synthesizes responses from multiple AI agents.
 */

// Types
export type {
  AgentResponse,
  CompilationResult,
  CompilationContext,
} from './types';

// Compiler Engine
export {
  buildCompilerSystemPrompt,
  executeResponseCompiler,
} from './lib/compilerEngine';
