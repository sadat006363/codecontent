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
import crypto from 'crypto';

// ============================================================
// 🔥 کش ساده در حافظه
// ============================================================

interface CacheEntry {
  result: GenerateResponseValidated;
  timestamp: number;
  pipelineTrace?: unknown;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function getCacheKey(code: string, language: string, mode: string): string {
  const hash = crypto.createHash('sha256').update(`${code}|${language}|${mode}`).digest('hex');
  return hash;
}

function getCachedResult(key: string): CacheEntry | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry;
}

function setCacheResult(key: string, result: GenerateResponseValidated, pipelineTrace?: unknown): void {
  cache.set(key, {
    result,
    timestamp: Date.now(),
    pipelineTrace,
  });
  if (cache.size > 1000) {
    const keys = Array.from(cache.keys());
    const toDelete = keys.slice(0, cache.size - 1000);
    for (const k of toDelete) {
      cache.delete(k);
    }
  }
}

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

// ============================================================
// 4. Streaming Handler
// ============================================================

async function processGenerateRequest(
  code: string,
  language: string,
  mode: Mode,
  ip: string
): Promise<{ result: GenerateResponseValidated; pipelineTrace?: unknown }> {
  // ===== بررسی کش =====
  const cacheKey = getCacheKey(code, language, mode);
  const cached = getCachedResult(cacheKey);
  if (cached) {
    logger.info(`[generate] Cache hit for IP ${ip}, mode ${mode}`);
    return { result: cached.result, pipelineTrace: cached.pipelineTrace };
  }

  // ===== Mock =====
  if (process.env.USE_MOCK_RESPONSE === 'true' && mode === 'advanced') {
    logger.info(`[generate] Using mock response for advanced mode (IP ${ip})`);
    const validatedMock = validateResponse(MOCK_RESPONSE);
    setCacheResult(cacheKey, validatedMock);
    return { result: validatedMock };
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
          pipelineTrace = pipelineResult.trace;
        } catch (schemaError) {
          logger.error('[generate] Pipeline output failed schema validation, falling back to legacy:', schemaError);
          const legacyResult = await generateEducationalContent(code, language, mode);
          result = validateResponse(legacyResult);
        }
      } else {
        logger.warn(`[generate] Advanced pipeline failed: ${pipelineResult.error}`);
        const legacyResult = await generateEducationalContent(code, language, mode);
        result = validateResponse(legacyResult);
      }
    } catch (pipelineError) {
      logger.error(`[generate] Pipeline error, falling back to legacy:`, pipelineError);
      const legacyResult = await generateEducationalContent(code, language, mode);
      result = validateResponse(legacyResult);
    }
  } else {
    logger.info(`[generate] Running legacy generation for mode ${mode} (IP ${ip})`);
    const legacyResult = await generateEducationalContent(code, language, mode);
    result = validateResponse(legacyResult);
  }

  // ===== ذخیره در کش =====
  setCacheResult(cacheKey, result, pipelineTrace);

  return { result, pipelineTrace };
}

// ============================================================
// 5. Main Handler (با Streaming)
// ============================================================

export const POST = withErrorHandlerAndLog(async (req: NextRequest) => {
  const startTime = Date.now();
  const ip = getClientIP(req);
  const acceptHeader = req.headers.get('accept') || '';

  // ===== Rate Limiter =====
  const rateLimitResult = await rateLimiter(ip);
  if (!rateLimitResult.allowed) {
    logger.warn(`[generate] Rate limit exceeded for IP ${ip}`);
    return NextResponse.json(
      { error: rateLimitResult.message },
      { status: 429 }
    );
  }

  // ===== Parse Request =====
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
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
      { error: `Unsupported language: "${rawLanguage}" (normalized: "${language}").` },
      { status: 400 }
    );
  }

  const lines = code.split(/\r?\n/).length;
  if (lines > MAX_LINES_GENERATE) {
    return NextResponse.json(
      { error: `Code exceeds ${MAX_LINES_GENERATE} lines (${lines} lines).` },
      { status: 400 }
    );
  }

  const byteLength = Buffer.byteLength(JSON.stringify(rawBody), 'utf8');
  if (byteLength > 100000) {
    return NextResponse.json({ error: 'Payload too large (max 100KB)' }, { status: 413 });
  }

  // ============================================================
  // 🔥 Streaming Response (اگر کلاینت درخواست کرده باشد)
  // ============================================================
  if (acceptHeader.includes('text/event-stream') || acceptHeader.includes('stream')) {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // ===== ارسال پیام شروع =====
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'start', message: 'Analysis started...' })}\n\n`));

          // ===== پردازش =====
          const { result, pipelineTrace } = await processGenerateRequest(code, language, mode, ip);

          // ===== ارسال نتیجه =====
          const responseData = { ...result };
          if (pipelineTrace) {
            (responseData as any).debug_trace = pipelineTrace;
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete', data: responseData })}\n\n`));

          // ===== ارسال پیام پایان =====
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', message: 'Analysis complete!' })}\n\n`));
        } catch (error) {
          logger.error('[generate] Stream error:', error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Analysis failed' })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    const duration = Date.now() - startTime;
    logger.info(`[generate] Stream completed in ${duration}ms for mode ${mode} (IP ${ip})`);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  // ============================================================
  // 🔥 Regular Response (بدون Streaming)
  // ============================================================
  const { result, pipelineTrace } = await processGenerateRequest(code, language, mode, ip);

  const responseData = { ...result };
  if (pipelineTrace) {
    (responseData as any).debug_trace = pipelineTrace;
  }

  const duration = Date.now() - startTime;
  logger.info(`[generate] Request completed in ${duration}ms for mode ${mode} (IP ${ip})`);

  return NextResponse.json(responseData);
});