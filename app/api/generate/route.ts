// app/api/generate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { generateEducationalContent } from '@/lib/ai';
import { runAdvancedPipeline } from '@/lib/analysis/pipeline';
import {
  MAX_LINES_GENERATE,
  MAX_CODE_LENGTH,
  SUPPORTED_LANGUAGES,
} from '@/lib/constants';
import { rateLimiter, getClientIP } from '@/lib/rateLimiter';
import { MOCK_RESPONSE } from '@/lib/mockData';
import logger from '@/lib/logger';
import { z } from 'zod';
import { AdvancedAuditResultSchema } from '@/lib/analysis/schema';
import { normalizeAnalysisOutput } from '@/lib/analysis/normalizer';
import { withErrorHandlerAndLog } from '@/lib/errorHandler';

// ============================================================
// 1. Schemas
// ============================================================

const ModeValues = ['simple', 'medium', 'advanced'] as const;
type Mode = typeof ModeValues[number];

const ModeSchema = z.enum(ModeValues);

const GenerateRequestSchema = z.object({
  code: z.string().min(1, 'Code is required').max(MAX_CODE_LENGTH, `Code exceeds maximum length of ${MAX_CODE_LENGTH} characters`),
  language: z.string().min(1, 'Language is required').max(50, 'Language name too long'),
  mode: ModeSchema,
});

type GenerateRequestValidated = z.infer<typeof GenerateRequestSchema>;

const GenerateResponseSchema = z.object({
  linkedin_post: z.string().min(1).max(300),
}).passthrough();

type GenerateResponseValidated = z.infer<typeof GenerateResponseSchema>;

// ============================================================
// 2. Language helpers
// ============================================================

const supportedLanguagesSet = new Set<string>(SUPPORTED_LANGUAGES);

const languageAliases: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  rb: 'ruby',
  'c++': 'cpp',
  'c#': 'csharp',
  cs: 'csharp',
  kt: 'kotlin',
  swift: 'swift',
  go: 'go',
  rs: 'rust',
  php: 'php',
  html: 'html',
  htm: 'html',
  css: 'css',
  json: 'json',
  xml: 'xml',
  yml: 'yaml',
  yaml: 'yaml',
  sh: 'bash',
  bash: 'bash',
  shell: 'bash',
  sql: 'sql',
};

function normalizeLanguage(lang: string): string {
  const normalized = lang.toLowerCase().trim();
  return languageAliases[normalized] || normalized;
}

function isSupportedLanguage(lang: string): boolean {
  const normalized = normalizeLanguage(lang);
  return supportedLanguagesSet.has(normalized);
}

// ============================================================
// 3. Helpers
// ============================================================

function validateResponse(result: unknown): GenerateResponseValidated {
  const withDefault = {
    ...(result as Record<string, unknown>),
    linkedin_post: (result as Record<string, unknown>)?.linkedin_post || 'Check out this code analysis! #Zbloue',
  };
  return GenerateResponseSchema.parse(withDefault);
}

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.message.includes('rate limit') || error.message.includes('validation')) {
      return error.message;
    }
    return 'AI processing failed. Please try again.';
  }
  return 'AI processing failed. Please try again.';
}

// ============================================================
// 4. Main handler
// ============================================================

export const POST = withErrorHandlerAndLog(async (req: NextRequest) => {
  const startTime = Date.now();
  const ip = getClientIP(req);

  const rateLimitResult = await rateLimiter(ip);
  if (!rateLimitResult.allowed) {
    logger.warn(`[generate] Rate limit exceeded for IP ${ip}`);
    return NextResponse.json(
      { error: rateLimitResult.message },
      { status: 429 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    logger.warn(`[generate] Invalid JSON from IP ${ip}`);
    return NextResponse.json(
      { error: 'Invalid JSON payload' },
      { status: 400 }
    );
  }

  const validation = GenerateRequestSchema.safeParse(rawBody);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    logger.warn(`[generate] Validation failed for IP ${ip}: ${firstError.path.join('.')} - ${firstError.message}`);
    return NextResponse.json(
      { error: `Validation error: ${firstError.path.join('.')} - ${firstError.message}` },
      { status: 400 }
    );
  }

  const { code, language: rawLanguage, mode } = validation.data;
  const language = normalizeLanguage(rawLanguage);

  if (!isSupportedLanguage(language)) {
    return NextResponse.json(
      {
        error: `Unsupported language: "${rawLanguage}" (normalized: "${language}"). Supported: ${Array.from(supportedLanguagesSet).join(', ')}`,
      },
      { status: 400 }
    );
  }

  const lines = code.split(/\r?\n/).length;
  if (lines > MAX_LINES_GENERATE) {
    return NextResponse.json(
      { error: `Code exceeds ${MAX_LINES_GENERATE} lines (${lines} lines). Please shorten your code.` },
      { status: 400 }
    );
  }

  const rawBodyString = JSON.stringify(rawBody);
  const byteLength = Buffer.byteLength(rawBodyString, 'utf8');
  if (byteLength > 100000) {
    return NextResponse.json(
      { error: 'Payload too large (max 100KB)' },
      { status: 413 }
    );
  }

  if (process.env.USE_MOCK_RESPONSE === 'true' && mode === 'advanced') {
    logger.info(`[generate] Using mock response for advanced mode (IP ${ip})`);
    try {
      const validatedMock = validateResponse(MOCK_RESPONSE);
      return NextResponse.json(validatedMock);
    } catch (mockError) {
      logger.error('[generate] Mock response validation failed:', mockError);
    }
  }

  let result: GenerateResponseValidated;
  let pipelineTrace: unknown = null;

  if (mode === 'advanced') {
    logger.info(`[generate] Running advanced pipeline for IP ${ip}`);
    try {
      const pipelineResult = await runAdvancedPipeline(code, language);
      if (pipelineResult.result) {
        try {
          const normalized = normalizeAnalysisOutput(pipelineResult.result);
          const validated = AdvancedAuditResultSchema.parse(normalized);
          result = {
            ...validated,
            linkedin_post: validated.linkedin_post || 'Check out this code analysis! #Zbloue',
          } as GenerateResponseValidated;
          logger.info(`[generate] Advanced pipeline succeeded with status: ${pipelineResult.status}`);
          // ذخیره trace در result برای استفاده در صفحه اسنیپت
          pipelineTrace = pipelineResult.trace;
        } catch (schemaError) {
          logger.error('[generate] Pipeline output failed schema validation, falling back to legacy:', schemaError);
          const legacyResult = await generateEducationalContent(code, language, mode);
          result = validateResponse(legacyResult);
          logger.info(`[generate] Fallback to legacy advanced completed after schema validation failure`);
        }
      } else {
        logger.warn(`[generate] Advanced pipeline failed: ${pipelineResult.error}`);
        const legacyResult = await generateEducationalContent(code, language, mode);
        result = validateResponse(legacyResult);
        logger.info(`[generate] Fallback to legacy advanced completed after pipeline failure`);
      }
    } catch (pipelineError) {
      logger.error(`[generate] Pipeline error, falling back to legacy:`, pipelineError);
      const legacyResult = await generateEducationalContent(code, language, mode);
      result = validateResponse(legacyResult);
      logger.info(`[generate] Fallback to legacy advanced completed after pipeline error`);
    }
  } else {
    logger.info(`[generate] Running legacy generation for mode ${mode} (IP ${ip})`);
    const legacyResult = await generateEducationalContent(code, language, mode);
    result = validateResponse(legacyResult);
  }

  const duration = Date.now() - startTime;
  logger.info(`[generate] Request completed in ${duration}ms for mode ${mode} (IP ${ip})`);

  // در صورت وجود trace، آن را به response اضافه می‌کنیم (برای ذخیره در دیتابیس)
  const responseData = { ...result };
  if (pipelineTrace) {
    (responseData as any).debug_trace = pipelineTrace;
  }

  return NextResponse.json(responseData);
});