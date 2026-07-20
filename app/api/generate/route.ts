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

// ============================================================
// 1. Request validation schema
// ============================================================

const GenerateRequestSchema = z.object({
  code: z.string().min(1, 'Code is required').max(MAX_CODE_LENGTH, `Code exceeds maximum length of ${MAX_CODE_LENGTH} characters`),
  language: z.string().min(1, 'Language is required').max(50, 'Language name too long'),
  mode: z.enum(['simple', 'medium', 'advanced'], {
    errorMap: () => ({ message: 'Mode must be simple, medium, or advanced' }),
  }),
});

// ============================================================
// 2. Response validation (minimal shared contract)
// ============================================================

// We only guarantee linkedin_post exists, other fields are passed through.
const GenerateResponseSchema = z.object({
  linkedin_post: z.string().min(1).max(300),
}).passthrough(); // allow any other fields

type GenerateResponseValidated = z.infer<typeof GenerateResponseSchema>;

// ============================================================
// 3. Language normalization and validation
// ============================================================

// Ensure SUPPORTED_LANGUAGES is a readonly array with literal types
// (this should be defined in lib/constants.ts as 'as const')
// For safety, we cast it here:
const supportedLanguagesSet = new Set(SUPPORTED_LANGUAGES);

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
// 4. Helpers
// ============================================================

function validateResponse(result: unknown): GenerateResponseValidated {
  // This ensures linkedin_post exists, but passes through all other fields
  return GenerateResponseSchema.parse(result);
}

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Only expose specific non-sensitive error types
    if (error.message.includes('rate limit') || error.message.includes('validation')) {
      return error.message;
    }
    return 'AI processing failed. Please try again.';
  }
  return 'AI processing failed. Please try again.';
}

// ============================================================
// 5. Main handler
// ============================================================

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const ip = getClientIP(req);

  try {
    // --- Rate limiting ---
    const rateLimitResult = rateLimiter(ip);
    if (!rateLimitResult.allowed) {
      logger.warn(`[generate] Rate limit exceeded for IP ${ip}`);
      return NextResponse.json(
        { error: rateLimitResult.message },
        { status: 429 }
      );
    }

    // --- Parse and validate request body ---
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

    // --- Normalize language ---
    const language = normalizeLanguage(rawLanguage);

    // --- Validate language (use normalized) ---
    if (!isSupportedLanguage(language)) {
      // Show the raw language in the error message, but mention the normalized form
      return NextResponse.json(
        {
          error: `Unsupported language: "${rawLanguage}" (normalized: "${language}"). Supported: ${Array.from(supportedLanguagesSet).join(', ')}`,
        },
        { status: 400 }
      );
    }

    // --- Code limits ---
    const lines = code.split(/\r?\n/).length;
    if (lines > MAX_LINES_GENERATE) {
      return NextResponse.json(
        { error: `Code exceeds ${MAX_LINES_GENERATE} lines (${lines} lines). Please shorten your code.` },
        { status: 400 }
      );
    }

    // --- Payload size limit (using actual byte length) ---
    const rawBodyString = JSON.stringify(rawBody);
    const byteLength = Buffer.byteLength(rawBodyString, 'utf8');
    if (byteLength > 100000) {
      return NextResponse.json(
        { error: 'Payload too large (max 100KB)' },
        { status: 413 }
      );
    }

    // --- Mock response for debugging ---
    if (process.env.USE_MOCK_RESPONSE === 'true' && mode === 'advanced') {
      logger.info(`[generate] Using mock response for advanced mode (IP ${ip})`);
      try {
        const validatedMock = validateResponse(MOCK_RESPONSE);
        return NextResponse.json(validatedMock);
      } catch (mockError) {
        logger.error('[generate] Mock response validation failed:', mockError);
        // Fall through to real generation
      }
    }

    // --- Execute AI ---
    let result: GenerateResponseValidated;

    if (mode === 'advanced') {
      logger.info(`[generate] Running advanced pipeline for IP ${ip}`);
      try {
        const pipelineResult = await runAdvancedPipeline(code, language);
        if (pipelineResult.result) {
          // Ensure the pipeline output conforms to the canonical schema
          try {
            const validated = AdvancedAuditResultSchema.parse(pipelineResult.result);
            // Merge with guaranteed linkedin_post
            result = {
              ...validated,
              linkedin_post: validated.linkedin_post || 'Check out this code analysis! #Zbloue',
            } as GenerateResponseValidated;
            logger.info(`[generate] Advanced pipeline succeeded with status: ${pipelineResult.status}`);
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

    // --- Response ---
    const duration = Date.now() - startTime;
    logger.info(`[generate] Request completed in ${duration}ms for mode ${mode} (IP ${ip})`);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const safeMessage = getSafeErrorMessage(error);
    logger.error(`[generate] Unhandled error after ${duration}ms for IP ${ip}:`, error);
    return NextResponse.json(
      { error: safeMessage },
      { status: 500 }
    );
  }
}