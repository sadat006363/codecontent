// lib/openaiClient.ts

import { callLLM, callLLMJson, type GatewayRequest, type GatewayResult } from './llm-gateway';
import type { z } from 'zod';

// ============================================================
// 🔥 Legacy interface - wraps the new Gateway
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
// 🔥 Legacy callOpenAI - uses Gateway for Advanced, direct for others
// ============================================================

export async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  options: OpenAICallOptions = {}
): Promise<string> {
  const mode = options.mode || 'advanced';

  // For Advanced mode, use the Gateway with GPT-5 family
  if (mode === 'advanced' && process.env.LLM_GATEWAY_ENABLED !== 'false') {
    const result = await callLLM<string>({
      systemPrompt,
      userPrompt,
      role: 'primary',
      temperature: options.temperature,
      maxTokens: options.maxCompletionTokens,
      responseFormat: options.responseFormat || 'json_object',
    });

    if (result.success && result.data !== undefined) {
      return result.data as string;
    }

    // If Gateway fails, we could fall back to legacy, but we'll throw the error
    throw new Error(result.error?.message || 'LLM Gateway request failed');
  }

  // For Simple/Medium or when Gateway is disabled, use the legacy direct call
  const config = MODEL_CONFIG[mode];
  const model = options.model || config.model;
  const maxCompletionTokens = options.maxCompletionTokens || config.maxCompletionTokens;
  const timeout = options.timeout || config.timeout;
  const temperature = options.temperature ?? config.temperature;
  const responseFormat = options.responseFormat || 'json_object';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch('/api/openai-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemPrompt,
        userPrompt,
        model,
        maxCompletionTokens,
        temperature,
        responseFormat,
        mode,
      }),
      signal: options.signal || controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'OpenAI request failed');
    }

    const data = await response.json();
    return data.content || '{}';
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout / 1000}s`);
    }
    throw error;
  }
}

// ============================================================
// 🔥 Legacy callOpenAIJson
// ============================================================

export async function callOpenAIJson<T>(
  systemPrompt: string,
  userPrompt: string,
  options: OpenAICallOptions = {}
): Promise<T> {
  const content = await callOpenAI(systemPrompt, userPrompt, {
    ...options,
    responseFormat: 'json_object',
  });

  try {
    return JSON.parse(content) as T;
  } catch (parseError) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[OpenAI] JSON Parse Error:', parseError);
      console.error('[OpenAI] Raw content:', content);
    }
    throw new Error('AI response format error. Please try again.');
  }
}

// ============================================================
// 🔥 New: Direct Gateway access for Advanced pipeline
// ============================================================

export { callLLM, callLLMJson } from './llm-gateway';
export type { GatewayRequest, GatewayResult } from './llm-gateway';