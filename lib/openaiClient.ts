// lib/openaiClient.ts

import { callLLM, callLLMJson, type GatewayRequest, type GatewayResult } from './llm-gateway';
import type { z } from 'zod';

// ============================================================
// 🔥 Legacy configuration (برای سازگاری با عقب)
// ============================================================

export const MODEL_CONFIG = {
  simple: {
    model: process.env.OPENAI_MODEL_SIMPLE || 'gpt-4o-mini',
    maxCompletionTokens: parseInt(process.env.OPENAI_MAX_TOKENS_SIMPLE || '4000', 10),
    timeout: parseInt(process.env.OPENAI_TIMEOUT_SIMPLE || '30000', 10),
    temperature: 0.3,
  },
  medium: {
    model: process.env.OPENAI_MODEL_MEDIUM || 'gpt-4o-mini',
    maxCompletionTokens: parseInt(process.env.OPENAI_MAX_TOKENS_MEDIUM || '6000', 10),
    timeout: parseInt(process.env.OPENAI_TIMEOUT_MEDIUM || '45000', 10),
    temperature: 0.3,
  },
  advanced: {
    model: process.env.OPENAI_MODEL_ADVANCED || 'gpt-4o',
    maxCompletionTokens: parseInt(process.env.OPENAI_MAX_TOKENS_ADVANCED || '16000', 10),
    timeout: parseInt(process.env.OPENAI_TIMEOUT_ADVANCED || '90000', 10),
    temperature: 0.2,
  },
} as const;

export type ModelMode = keyof typeof MODEL_CONFIG;

// ============================================================
// 🔥 نگاشت mode به role در Gateway
// ============================================================

const MODE_TO_GATEWAY_ROLE: Record<ModelMode, 'primary' | 'codeFallback' | 'stableFallback'> = {
  simple: 'stableFallback',   // gpt-4o-mini
  medium: 'codeFallback',      // gpt-4o-mini
  advanced: 'primary',         // gpt-4o
};

// ============================================================
// 🔥 گزینه‌های فراخوانی
// ============================================================

export interface OpenAICallOptions {
  mode?: ModelMode;
  model?: string;
  maxCompletionTokens?: number;
  timeout?: number;
  temperature?: number;
  responseFormat?: 'json_object' | 'text';
  signal?: AbortSignal;
}

// ============================================================
// 🔥 تابع اصلی با Gateway (برای همه حالت‌ها)
// ============================================================

export async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  options: OpenAICallOptions = {}
): Promise<string> {
  const mode = options.mode || 'advanced';
  const config = MODEL_CONFIG[mode];
  const role = MODE_TO_GATEWAY_ROLE[mode];

  const result = await callLLM<string>({
    systemPrompt,
    userPrompt,
    role,
    temperature: options.temperature ?? config.temperature,
    maxTokens: options.maxCompletionTokens || config.maxCompletionTokens,
    responseFormat: options.responseFormat || 'json_object',
    rootRequestId: `callOpenAI-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  });

  if (result.success && result.data !== undefined) {
    return result.data as string;
  }

  throw new Error(result.error?.message || 'LLM Gateway request failed');
}

// ============================================================
// 🔥 تابع JSON (با Gateway)
// ============================================================

export async function callOpenAIJson<T>(
  systemPrompt: string,
  userPrompt: string,
  options: OpenAICallOptions = {}
): Promise<T> {
  const mode = options.mode || 'advanced';
  const config = MODEL_CONFIG[mode];
  const role = MODE_TO_GATEWAY_ROLE[mode];

  const result = await callLLMJson<T>(systemPrompt, userPrompt, {
    role,
    schema: undefined as any,
    temperature: options.temperature ?? config.temperature,
    maxTokens: options.maxCompletionTokens || config.maxCompletionTokens,
    rootRequestId: `callOpenAIJson-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  });

  if (result.success && result.data !== undefined) {
    return result.data as T;
  }

  throw new Error(result.error?.message || 'LLM Gateway JSON request failed');
}

// ============================================================
// 🔥 Export مستقیم Gateway برای استفاده در Pipeline
// ============================================================

export { callLLM, callLLMJson } from './llm-gateway';
export type { GatewayRequest, GatewayResult } from './llm-gateway';