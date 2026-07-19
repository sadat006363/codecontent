// ============================================================
// 📁 فایل: app/api/generate/route.ts
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { generateEducationalContent } from '@/lib/ai';
import { runAdvancedPipeline } from '@/lib/analysis/pipeline';
import { GenerateRequest } from '@/types';
import {
  MAX_LINES_GENERATE,
  MAX_CODE_LENGTH,
  SUPPORTED_LANGUAGES,
} from '@/lib/constants';
import { rateLimiter, getClientIP } from '@/lib/rateLimiter';
import { MOCK_RESPONSE } from '@/lib/mockData';
import logger from '@/lib/logger';

function isSupportedLanguage(lang: string): lang is typeof SUPPORTED_LANGUAGES[number] {
  return SUPPORTED_LANGUAGES.includes(lang as any);
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const ip = getClientIP(req);
    const rateLimitResult = rateLimiter(ip);
    if (!rateLimitResult.allowed) {
      logger.warn(`Rate limit exceeded for IP ${ip}`);
      return NextResponse.json(
        { error: rateLimitResult.message },
        { status: 429 }
      );
    }

    let body: GenerateRequest;
    try {
      body = await req.json();
    } catch (parseError) {
      logger.error('Invalid JSON payload', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const { code, language, mode } = body;

    if (!code || !language) {
      logger.warn('Missing code or language');
      return NextResponse.json(
        { error: 'Code and language are required' },
        { status: 400 }
      );
    }

    if (!mode || !['simple', 'medium', 'advanced'].includes(mode)) {
      return NextResponse.json(
        { error: 'Invalid mode. Use simple, medium, or advanced.' },
        { status: 400 }
      );
    }

    if (!isSupportedLanguage(language)) {
      return NextResponse.json(
        {
          error: `Unsupported language: ${language}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const lines = code.split('\n').length;
    if (lines > MAX_LINES_GENERATE) {
      return NextResponse.json(
        { error: `Code exceeds ${MAX_LINES_GENERATE} lines (${lines} lines). Please shorten your code.` },
        { status: 400 }
      );
    }

    if (code.length > MAX_CODE_LENGTH) {
      return NextResponse.json(
        { error: `Code is too long (${code.length} characters). Maximum is ${MAX_CODE_LENGTH} characters.` },
        { status: 400 }
      );
    }

    const payloadSize = JSON.stringify(body).length;
    if (payloadSize > 100000) {
      return NextResponse.json(
        { error: 'Payload too large (max 100KB)' },
        { status: 413 }
      );
    }

    if (process.env.USE_MOCK_RESPONSE === 'true' && mode === 'advanced') {
      logger.info('Using mock response for advanced mode');
      return NextResponse.json(MOCK_RESPONSE);
    }

    let result: any;

    if (mode === 'advanced') {
      try {
        const pipelineResult = await runAdvancedPipeline(code, language);
        if (pipelineResult.result) {
          result = {
            ...pipelineResult.result,
            status: pipelineResult.status,
          };
          logger.info('Advanced pipeline succeeded');
        } else {
          logger.warn('[API] Advanced pipeline failed, falling back to legacy:', pipelineResult.error);
          result = await generateEducationalContent(code, language, mode);
        }
      } catch (pipelineError) {
        logger.error('[API] Pipeline error, falling back to legacy:', pipelineError);
        result = await generateEducationalContent(code, language, mode);
      }
    } else {
      result = await generateEducationalContent(code, language, mode);
    }

    const duration = Date.now() - startTime;
    logger.info(`Request completed in ${duration}ms for mode ${mode}`);

    return NextResponse.json(result);
  } catch (error: any) {
    logger.error('[API] Unhandled error:', error);
    return NextResponse.json(
      { error: error.message || 'AI processing failed. Please try again.' },
      { status: 500 }
    );
  }
}