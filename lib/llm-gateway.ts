// lib/llm-gateway.ts

import OpenAI from 'openai';
import { z } from 'zod';
import {
  LLM_MODELS,
  ADVANCED_MODEL_ROLES,
  getModelByRole,
  getModelByKey,
  type ModelCapability,
  type AdvancedModelRole,
} from './llm-registry';
import logger from './logger';
import { randomUUID } from 'crypto';

// ============================================================
// 🔥 OpenAI Client
// ============================================================

const openaiApiKey = process.env.OPENAI_API_KEY || '';
if (!openaiApiKey) {
  console.warn('⚠️ OPENAI_API_KEY is not set. LLM Gateway will fail.');
}

const openai = new OpenAI({
  apiKey: openaiApiKey,
  timeout: parseInt(process.env.OPENAI_REQUEST_TIMEOUT_MS || '90000', 10),
});

// ============================================================
// 🔥 Types
// ============================================================

export interface GatewayRequest {
  systemPrompt: string;
  userPrompt: string;
  role?: AdvancedModelRole;
  modelKey?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json_object' | 'text';
  schema?: z.ZodSchema;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface GatewayResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: NormalizedLLMError;
  modelUsed: string;
  modelKey: string;
  api: string;
  attempt: number;
  durationMs: number;
}

export interface NormalizedLLMError {
  code: LLMErrorCode;
  message: string;
  retryable: boolean;
  providerStatus?: number;
  providerCode?: string;
  model?: string;
  requestId?: string;
  attempt?: number;
  cause?: string;
}

export type LLMErrorCode =
  | 'AUTHENTICATION_ERROR'
  | 'MODEL_UNAVAILABLE'
  | 'UNSUPPORTED_PARAMETER'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'PROVIDER_UNAVAILABLE'
  | 'INVALID_RESPONSE'
  | 'SCHEMA_VALIDATION_FAILED'
  | 'BAD_REQUEST'
  | 'UNKNOWN';

// ============================================================
// 🔥 Configuration
// ============================================================

const MAX_RETRIES = parseInt(process.env.OPENAI_MAX_RETRIES || '2', 10);
const REQUEST_TIMEOUT_MS = parseInt(process.env.OPENAI_REQUEST_TIMEOUT_MS || '90000', 10);
const GATEWAY_ENABLED = process.env.LLM_GATEWAY_ENABLED !== 'false';

// ============================================================
// 🔥 Error Classification
// ============================================================

function classifyError(error: unknown, modelKey: string): NormalizedLLMError {
  const defaultError: NormalizedLLMError = {
    code: 'UNKNOWN',
    message: 'An unknown error occurred',
    retryable: false,
    model: modelKey,
  };

  if (!error || typeof error !== 'object') return defaultError;

  const err = error as any;

  // OpenAI SDK errors have a status and error property
  const status = err.status || err.statusCode;
  const providerCode = err.code || err.error?.code;
  const providerMessage = err.message || err.error?.message || '';

  // Authentication errors
  if (status === 401 || providerCode === 'invalid_api_key' || providerMessage.includes('API key')) {
    return {
      code: 'AUTHENTICATION_ERROR',
      message: 'Invalid OpenAI API key. Please check your configuration.',
      retryable: false,
      providerStatus: status,
      providerCode,
      model: modelKey,
    };
  }

  // Model not found / permission errors
  if (status === 404 || providerCode === 'model_not_found' || providerMessage.includes('model')) {
    return {
      code: 'MODEL_UNAVAILABLE',
      message: `Model "${modelKey}" is not available.`,
      retryable: false,
      providerStatus: status,
      providerCode,
      model: modelKey,
    };
  }

  // Unsupported parameter errors
  if (providerCode === 'unsupported_parameter' || providerMessage.includes('unsupported parameter')) {
    return {
      code: 'UNSUPPORTED_PARAMETER',
      message: providerMessage,
      retryable: false,
      providerStatus: status,
      providerCode,
      model: modelKey,
    };
  }

  // Rate limiting
  if (status === 429 || providerCode === 'rate_limit_exceeded') {
    return {
      code: 'RATE_LIMITED',
      message: 'Rate limit exceeded. Please try again later.',
      retryable: true,
      providerStatus: status,
      providerCode,
      model: modelKey,
    };
  }

  // Timeout
  if (err.name === 'AbortError' || err.name === 'TimeoutError' || providerMessage.includes('timeout')) {
    return {
      code: 'TIMEOUT',
      message: 'Request timed out.',
      retryable: true,
      providerStatus: status,
      providerCode,
      model: modelKey,
    };
  }

  // Server errors (5xx)
  if (status && status >= 500 && status < 600) {
    return {
      code: 'PROVIDER_UNAVAILABLE',
      message: 'OpenAI service is temporarily unavailable.',
      retryable: true,
      providerStatus: status,
      providerCode,
      model: modelKey,
    };
  }

  // Bad request (400) - usually not retryable
  if (status === 400) {
    return {
      code: 'BAD_REQUEST',
      message: providerMessage || 'Invalid request.',
      retryable: false,
      providerStatus: status,
      providerCode,
      model: modelKey,
    };
  }

  return {
    code: 'UNKNOWN',
    message: providerMessage || 'An unknown error occurred',
    retryable: false,
    providerStatus: status,
    providerCode,
    model: modelKey,
  };
}

// ============================================================
// 🔥 Sleep helper (with jitter)
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBackoffDelay(attempt: number): number {
  const base = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
  const jitter = Math.random() * 200;
  return base + jitter;
}

// ============================================================
// 🔥 Build payload
// ============================================================

function buildPayload(
  model: ModelCapability,
  systemPrompt: string,
  userPrompt: string,
  options: {
    temperature?: number;
    maxTokens?: number;
    responseFormat?: 'json_object' | 'text';
  }
): any {
  const payload: any = {
    model: model.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  };

  // ===== Token parameter =====
  const maxTokens = options.maxTokens || model.defaultMaxTokens;
  payload[model.tokenParam] = maxTokens;

  // ===== Temperature =====
  if (model.supportsTemperature && options.temperature !== undefined) {
    payload.temperature = options.temperature;
  } else if (model.supportsTemperature) {
    // Default temperature for models that support it
    payload.temperature = 0.3;
  }
  // If supportsTemperature is false, we do NOT send temperature

  // ===== Reasoning =====
  if (model.supportsReasoning && model.reasoningEffort) {
    payload.reasoning = {
      effort: model.reasoningEffort,
    };
  }

  // ===== Response format (JSON) =====
  if (options.responseFormat === 'json_object') {
    payload.response_format = { type: 'json_object' };
  }

  return payload;
}

// ============================================================
// 🔥 Execute a single model call
// ============================================================

async function executeModelCall(
  model: ModelCapability,
  systemPrompt: string,
  userPrompt: string,
  options: {
    temperature?: number;
    maxTokens?: number;
    responseFormat?: 'json_object' | 'text';
    signal?: AbortSignal;
  }
): Promise<{ content: string; model: string; api: string }> {
  const payload = buildPayload(model, systemPrompt, userPrompt, options);

  // AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await openai.chat.completions.create(payload, {
      signal: options.signal || controller.signal,
    });

    clearTimeout(timeoutId);

    const content = response.choices[0]?.message?.content || '';
    return {
      content,
      model: model.model,
      api: 'chat-completions',
    };
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// ============================================================
// 🔥 Main Gateway function
// ============================================================

export async function callLLM<T = unknown>(
  request: GatewayRequest
): Promise<GatewayResult<T>> {
  const startTime = Date.now();
  const requestId = request.requestId || randomUUID();

  // Determine model key and capability
  let modelKey: string;
  if (request.modelKey) {
    modelKey = request.modelKey;
  } else if (request.role) {
    const roleMap: Record<AdvancedModelRole, string> = {
      primary: 'gpt-5.4',
      codeFallback: 'gpt-5.3-codex',
      stableFallback: 'gpt-5.1',
    };
    modelKey = roleMap[request.role] || 'gpt-5.4';
  } else {
    modelKey = 'gpt-5.4';
  }

  // Fallback order for Advanced pipeline
  const fallbackOrder: string[] = ['gpt-5.4', 'gpt-5.3-codex', 'gpt-5.1'];

  let lastError: NormalizedLLMError | null = null;
  let attempts = 0;

  // Determine which models to try
  let modelsToTry: string[];
  if (request.role) {
    const roleMap: Record<AdvancedModelRole, string[]> = {
      primary: ['gpt-5.4', 'gpt-5.3-codex', 'gpt-5.1'],
      codeFallback: ['gpt-5.3-codex', 'gpt-5.1', 'gpt-5.4'],
      stableFallback: ['gpt-5.1', 'gpt-5.4', 'gpt-5.3-codex'],
    };
    modelsToTry = roleMap[request.role] || fallbackOrder;
  } else {
    modelsToTry = [modelKey];
  }

  // Ensure we don't loop indefinitely
  const maxAttempts = Math.min(modelsToTry.length * (MAX_RETRIES + 1), 9);

  // Track which models we've already tried
  const triedModels = new Set<string>();

  for (const key of modelsToTry) {
    if (triedModels.has(key)) continue;
    triedModels.add(key);

    const model = getModelByKey(key);
    if (!model) {
      logger.warn(`[LLM Gateway] Model "${key}" not found in registry, skipping.`, { requestId });
      continue;
    }

    let retryCount = 0;
    let shouldRetry = true;

    while (shouldRetry && retryCount <= MAX_RETRIES && attempts < maxAttempts) {
      attempts++;

      try {
        const result = await executeModelCall(
          model,
          request.systemPrompt,
          request.userPrompt,
          {
            temperature: request.temperature,
            maxTokens: request.maxTokens,
            responseFormat: request.responseFormat || 'json_object',
          }
        );

        // ===== Validate with Zod if schema provided =====
        let parsedData: T | undefined;
        let validationError: NormalizedLLMError | null = null;

        if (request.schema) {
          try {
            const parsed = request.schema.safeParse(JSON.parse(result.content));
            if (parsed.success) {
              parsedData = parsed.data as T;
            } else {
              validationError = {
                code: 'SCHEMA_VALIDATION_FAILED',
                message: 'Zod validation failed',
                retryable: false,
                model: key,
                requestId,
                attempt: attempts,
                cause: JSON.stringify(parsed.error.issues),
              };
            }
          } catch (parseError) {
            // Invalid JSON - try to repair once
            if (attempts === 1) {
              // One repair attempt via re-parsing the raw content
              try {
                // Try to extract JSON from the response
                const jsonMatch = result.content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  const repaired = JSON.parse(jsonMatch[0]);
                  if (request.schema.safeParse(repaired).success) {
                    parsedData = repaired as T;
                  } else {
                    validationError = {
                      code: 'INVALID_RESPONSE',
                      message: 'Invalid JSON response after repair attempt',
                      retryable: false,
                      model: key,
                      requestId,
                      attempt: attempts,
                    };
                  }
                } else {
                  validationError = {
                    code: 'INVALID_RESPONSE',
                    message: 'No JSON found in response',
                    retryable: false,
                    model: key,
                    requestId,
                    attempt: attempts,
                  };
                }
              } catch {
                validationError = {
                  code: 'INVALID_RESPONSE',
                  message: 'Failed to parse or repair JSON response',
                  retryable: false,
                  model: key,
                  requestId,
                  attempt: attempts,
                };
              }
            } else {
              validationError = {
                code: 'INVALID_RESPONSE',
                message: 'Invalid JSON response',
                retryable: false,
                model: key,
                requestId,
                attempt: attempts,
              };
            }
          }
        } else {
          // No schema validation - just use the content as a string
          parsedData = result.content as T;
        }

        if (validationError) {
          lastError = validationError;
          // Try next model if validation fails (not retryable)
          break;
        }

        // ===== Success =====
        const durationMs = Date.now() - startTime;

        // Safe logging (no API keys, no full source)
        logger.info('[LLM Gateway] Request successful', {
          requestId,
          modelKey: key,
          model: model.model,
          api: model.api,
          attempt: attempts,
          durationMs,
          success: true,
        });

        return {
          success: true,
          data: parsedData,
          modelUsed: model.model,
          modelKey: key,
          api: model.api,
          attempt: attempts,
          durationMs,
        };
      } catch (error) {
        const normalized = classifyError(error, key);

        // ===== Check if this error is retryable =====
        if (normalized.retryable && retryCount < MAX_RETRIES) {
          retryCount++;
          const delay = getBackoffDelay(retryCount);
          logger.warn(`[LLM Gateway] Retryable error, retrying in ${delay}ms`, {
            requestId,
            modelKey: key,
            attempt: attempts,
            retryCount,
            errorCode: normalized.code,
          });
          await sleep(delay);
          continue;
        }

        // ===== Non-retryable or max retries exceeded =====
        lastError = normalized;

        // If the error is model-related (unsupported, not found), try next model
        if (
          normalized.code === 'MODEL_UNAVAILABLE' ||
          normalized.code === 'UNSUPPORTED_PARAMETER'
        ) {
          logger.warn(`[LLM Gateway] Model-specific error, trying next model`, {
            requestId,
            modelKey: key,
            errorCode: normalized.code,
          });
          break; // Exit retry loop, continue to next model
        }

        // Authentication error - fail immediately
        if (normalized.code === 'AUTHENTICATION_ERROR') {
          logger.error('[LLM Gateway] Authentication error, aborting', {
            requestId,
            modelKey: key,
          });
          break;
        }

        // Other non-retryable errors - try next model
        if (!normalized.retryable) {
          break;
        }

        // If we got here and retryCount exceeded, try next model
        break;
      }
    }
  }

  // ===== All models failed =====
  const durationMs = Date.now() - startTime;
  const finalError = lastError || {
    code: 'UNKNOWN',
    message: 'All models failed',
    retryable: false,
    requestId,
    attempt: attempts,
  };

  logger.error('[LLM Gateway] All models failed', {
    requestId,
    attempts,
    durationMs,
    errorCode: finalError.code,
    errorMessage: finalError.message,
  });

  return {
    success: false,
    error: finalError,
    modelUsed: 'unknown',
    modelKey: 'unknown',
    api: 'unknown',
    attempt: attempts,
    durationMs,
  };
}

// ============================================================
// 🔥 Convenience wrapper for JSON responses with schema
// ============================================================

export async function callLLMJson<T>(
  systemPrompt: string,
  userPrompt: string,
  options: {
    role?: AdvancedModelRole;
    modelKey?: string;
    schema: z.ZodSchema<T>;
    temperature?: number;
    maxTokens?: number;
    requestId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<GatewayResult<T>> {
  return callLLM<T>({
    systemPrompt,
    userPrompt,
    role: options.role,
    modelKey: options.modelKey,
    schema: options.schema,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    requestId: options.requestId,
    metadata: options.metadata,
    responseFormat: 'json_object',
  });
}