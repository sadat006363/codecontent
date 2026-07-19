// ============================================================
// 📁 فایل: lib/openaiClient.ts (جدید)
// ============================================================
import OpenAI from 'openai';

export const MODEL_CONFIG = {
  simple: {
    model: process.env.OPENAI_MODEL_SIMPLE || 'gpt-4o-mini',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS_SIMPLE || '4000', 10),
    timeout: parseInt(process.env.OPENAI_TIMEOUT_SIMPLE || '30000', 10),
    temperature: 0.3,
  },
  medium: {
    model: process.env.OPENAI_MODEL_MEDIUM || 'gpt-4o-mini',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS_MEDIUM || '6000', 10),
    timeout: parseInt(process.env.OPENAI_TIMEOUT_MEDIUM || '45000', 10),
    temperature: 0.3,
  },
  advanced: {
    model: process.env.OPENAI_MODEL_ADVANCED || 'gpt-4o',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS_ADVANCED || '16000', 10),
    timeout: parseInt(process.env.OPENAI_TIMEOUT_ADVANCED || '90000', 10),
    temperature: 0.2,
  },
} as const;

export type ModelMode = keyof typeof MODEL_CONFIG;

const openaiApiKey = process.env.OPENAI_API_KEY || 'placeholder-key';
const openai = new OpenAI({ apiKey: openaiApiKey });

export interface OpenAICallOptions {
  mode?: ModelMode;
  model?: string;
  maxTokens?: number;
  timeout?: number;
  temperature?: number;
  responseFormat?: 'json_object' | 'text';
  signal?: AbortSignal;
}

export async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  options: OpenAICallOptions = {}
): Promise<string> {
  const mode = options.mode || 'advanced';
  const config = MODEL_CONFIG[mode];

  const model = options.model || config.model;
  const maxTokens = options.maxTokens || config.maxTokens;
  const timeout = options.timeout || config.timeout;
  const temperature = options.temperature ?? config.temperature;
  const responseFormat = options.responseFormat || 'json_object';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await openai.chat.completions.create(
      {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format:
          responseFormat === 'json_object' ? { type: 'json_object' } : undefined,
        temperature,
        max_tokens: maxTokens,
      },
      { signal: options.signal || controller.signal }
    );

    clearTimeout(timeoutId);
    return response.choices[0].message.content || '{}';
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout / 1000}s`);
    }
    throw error;
  }
}

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