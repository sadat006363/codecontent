// lib/llm-registry.ts

/**
 * Centralized model registry for all OpenAI models used in Zbloue.
 * All model names, capabilities, and environment variable mappings are defined here.
 */

export type ModelApi = 'chat-completions' | 'responses';

export type ModelPurpose = 'advanced-analysis' | 'code-analysis' | 'fallback' | 'legacy';

export type TokenParam = 'max_tokens' | 'max_completion_tokens' | 'max_output_tokens';

export interface ModelCapability {
  model: string;
  api: ModelApi;
  purpose: ModelPurpose;
  supportsReasoning: boolean;
  supportsTemperature: boolean;
  supportsTopP: boolean;
  supportsFrequencyPenalty: boolean;
  supportsPresencePenalty: boolean;
  tokenParam: TokenParam;
  defaultMaxTokens: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
}

export interface ModelRegistry {
  [key: string]: ModelCapability;
}

// ============================================================
// 🔥 Environment variable helpers
// ============================================================

function getEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function getEnvNumber(key: string, fallback: number): number {
  const val = process.env[key];
  if (val) {
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return fallback;
}

function getReasoningEffort(): 'low' | 'medium' | 'high' {
  const val = process.env.OPENAI_ADVANCED_REASONING_EFFORT;
  if (val === 'low' || val === 'medium' || val === 'high') return val;
  return 'medium';
}

// ============================================================
// 🔥 Model definitions
// ============================================================

export const LLM_MODELS: ModelRegistry = {
  // ===== GPT-5 Family (Advanced Pipeline) =====
  'gpt-5.4': {
    model: getEnv('OPENAI_ADVANCED_MODEL', 'gpt-5.4'),
    api: 'chat-completions',
    purpose: 'advanced-analysis',
    supportsReasoning: true,
    supportsTemperature: false,
    supportsTopP: false,
    supportsFrequencyPenalty: false,
    supportsPresencePenalty: false,
    tokenParam: 'max_completion_tokens',
    defaultMaxTokens: getEnvNumber('OPENAI_ADVANCED_MAX_OUTPUT_TOKENS', 12000),
    reasoningEffort: getReasoningEffort(),
  },

  'gpt-5.3-codex': {
    model: getEnv('OPENAI_CODE_MODEL', 'gpt-5.3-codex'),
    api: 'chat-completions',
    purpose: 'code-analysis',
    supportsReasoning: true,
    supportsTemperature: false,
    supportsTopP: false,
    supportsFrequencyPenalty: false,
    supportsPresencePenalty: false,
    tokenParam: 'max_completion_tokens',
    defaultMaxTokens: 12000,
    reasoningEffort: 'medium',
  },

  'gpt-5.1': {
    model: getEnv('OPENAI_FALLBACK_MODEL', 'gpt-5.1'),
    api: 'chat-completions',
    purpose: 'fallback',
    supportsReasoning: false,
    supportsTemperature: true,
    supportsTopP: true,
    supportsFrequencyPenalty: false,
    supportsPresencePenalty: false,
    tokenParam: 'max_completion_tokens',
    defaultMaxTokens: 12000,
  },

  // ===== Legacy models (for Simple/Medium) =====
  'gpt-4o': {
    model: 'gpt-4o',
    api: 'chat-completions',
    purpose: 'legacy',
    supportsReasoning: false,
    supportsTemperature: true,
    supportsTopP: true,
    supportsFrequencyPenalty: true,
    supportsPresencePenalty: true,
    tokenParam: 'max_completion_tokens',
    defaultMaxTokens: 16000,
  },

  'gpt-4o-mini': {
    model: 'gpt-4o-mini',
    api: 'chat-completions',
    purpose: 'legacy',
    supportsReasoning: false,
    supportsTemperature: true,
    supportsTopP: true,
    supportsFrequencyPenalty: true,
    supportsPresencePenalty: true,
    tokenParam: 'max_completion_tokens',
    defaultMaxTokens: 4000,
  },
};

// ============================================================
// 🔥 Model roles for Advanced pipeline
// ============================================================

export const ADVANCED_MODEL_ROLES = {
  primary: 'gpt-5.4',
  codeFallback: 'gpt-5.3-codex',
  stableFallback: 'gpt-5.1',
} as const;

export type AdvancedModelRole = keyof typeof ADVANCED_MODEL_ROLES;

// ============================================================
// 🔥 Helper to get model by role
// ============================================================

export function getModelByRole(role: AdvancedModelRole): ModelCapability {
  const key = ADVANCED_MODEL_ROLES[role];
  const model = LLM_MODELS[key];
  if (!model) {
    throw new Error(`Model "${key}" not found in registry for role "${role}"`);
  }
  return model;
}

// ============================================================
// 🔥 Helper to get model by key
// ============================================================

export function getModelByKey(key: string): ModelCapability | undefined {
  return LLM_MODELS[key];
}

// ============================================================
// 🔥 Helper to check if a model is available (by key)
// ============================================================

export function isModelAvailable(key: string): boolean {
  return !!LLM_MODELS[key];
}

// ============================================================
// 🔥 Helper to get all model keys
// ============================================================

export function getModelKeys(): string[] {
  return Object.keys(LLM_MODELS);
}