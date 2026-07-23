// lib/llm-registry.ts

import { z } from 'zod';

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

// ============================================================
// 🔥 Model Capabilities
// ============================================================

export type ModelApi = 'chat-completions' | 'responses' | 'messages';
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

// ============================================================
// 🔥 Model Registry (OpenAI + Anthropic)
// ============================================================

export const LLM_MODELS = {
  // ===== OpenAI =====
  'gpt-4o': {
    model: getEnv('OPENAI_ADVANCED_MODEL', 'gpt-4o'),
    api: 'chat-completions',
    purpose: 'advanced-analysis',
    supportsReasoning: false,
    supportsTemperature: true,
    supportsTopP: true,
    supportsFrequencyPenalty: true,
    supportsPresencePenalty: true,
    tokenParam: 'max_completion_tokens',
    defaultMaxTokens: getEnvNumber('OPENAI_ADVANCED_MAX_OUTPUT_TOKENS', 12000),
  },

  'gpt-4o-mini': {
    model: getEnv('OPENAI_CODE_MODEL', 'gpt-4o-mini'),
    api: 'chat-completions',
    purpose: 'code-analysis',
    supportsReasoning: false,
    supportsTemperature: true,
    supportsTopP: true,
    supportsFrequencyPenalty: true,
    supportsPresencePenalty: true,
    tokenParam: 'max_completion_tokens',
    defaultMaxTokens: 8000,
  },

  'gpt-4o-mini-fallback': {
    model: getEnv('OPENAI_FALLBACK_MODEL', 'gpt-4o-mini'),
    api: 'chat-completions',
    purpose: 'fallback',
    supportsReasoning: false,
    supportsTemperature: true,
    supportsTopP: true,
    supportsFrequencyPenalty: true,
    supportsPresencePenalty: true,
    tokenParam: 'max_completion_tokens',
    defaultMaxTokens: 8000,
  },

  'legacy-stable': {
    model: getEnv('OPENAI_LEGACY_MODEL', 'gpt-4o-mini'),
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

  // ===== Anthropic (ModelCapability فقط برای سازگاری) =====
  'claude-3-5-sonnet': {
    model: 'claude-3-5-sonnet-20241022',
    api: 'messages',
    purpose: 'advanced-analysis',
    supportsReasoning: false,
    supportsTemperature: true,
    supportsTopP: true,
    supportsFrequencyPenalty: false,
    supportsPresencePenalty: false,
    tokenParam: 'max_tokens',
    defaultMaxTokens: 8000,
  },

  'claude-3-opus': {
    model: 'claude-3-opus-20240229',
    api: 'messages',
    purpose: 'advanced-analysis',
    supportsReasoning: false,
    supportsTemperature: true,
    supportsTopP: true,
    supportsFrequencyPenalty: false,
    supportsPresencePenalty: false,
    tokenParam: 'max_tokens',
    defaultMaxTokens: 8000,
  },

  'claude-3-haiku': {
    model: 'claude-3-haiku-20240307',
    api: 'messages',
    purpose: 'code-analysis',
    supportsReasoning: false,
    supportsTemperature: true,
    supportsTopP: true,
    supportsFrequencyPenalty: false,
    supportsPresencePenalty: false,
    tokenParam: 'max_tokens',
    defaultMaxTokens: 4000,
  },
} as const;

// ============================================================
// 🔥 Advanced Model Roles
// ============================================================

export const ADVANCED_MODEL_ROLES = {
  primary: 'gpt-4o',
  codeFallback: 'gpt-4o-mini',
  stableFallback: 'gpt-4o-mini-fallback',
} as const;

export type AdvancedModelRole = keyof typeof ADVANCED_MODEL_ROLES;

// ============================================================
// 🔥 Helpers
// ============================================================

export function getModelByKey(key: string): ModelCapability | undefined {
  if (key in LLM_MODELS) {
    return LLM_MODELS[key as keyof typeof LLM_MODELS];
  }
  return undefined;
}

export function getModelKeys(): string[] {
  return Object.keys(LLM_MODELS);
}