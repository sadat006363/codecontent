// lib/analysis/prompts/index.ts

export { getBaseSystemInstructions } from './base';
export { buildConcurrencyAuditPrompt } from './concurrency';
export { buildGenericAdvancedPrompt } from './generic';
export { buildRepairPrompt } from './repair';

export enum AuditType {
  CONCURRENCY = 'concurrency',
  GENERIC = 'generic',
}