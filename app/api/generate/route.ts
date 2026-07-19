// app/api/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generateEducationalContent } from '@/lib/ai';
import { runAdvancedPipeline } from '@/lib/analysis/pipeline';
import { GenerateRequest } from '@/types';
import {
  MAX_LINES_GENERATE,
  MAX_CODE_LENGTH,
  MAX_REQUESTS_PER_IP,
  TIME_WINDOW,
  SUPPORTED_LANGUAGES,
} from '@/lib/constants';

// ===== Rate Limiting =====
const requestLog = new Map<string, { count: number; firstRequest: number }>();

function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  return '127.0.0.1';
}

function isSupportedLanguage(lang: string): lang is typeof SUPPORTED_LANGUAGES[number] {
  return SUPPORTED_LANGUAGES.includes(lang as any);
}

// ===== Mock response for debugging UI rendering =====
const MOCK_RESPONSE = {
  summary: 'Advanced concurrency analysis completed.',
  findings: [
    {
      title: 'Nested Submission & Thread-Starvation Deadlock',
      severity: 'critical',
      confidence: 'definite',
      category: 'thread-starvation',
      evidence: [
        {
          startLine: 120,
          endLine: 120,
          code: 'executor.submit(block::body);',
          explanation: 'Inner task submitted to same executor.',
        },
        {
          startLine: 122,
          endLine: 122,
          code: 'future.get();',
          explanation: 'Outer task blocks on inner task.',
        },
      ],
      executionPath: [
        'build() → submitWithBulkhead() → createTask() → executor.submit() → future.get()',
      ],
      triggerConditions: [
        'Pool size = N',
        'N outer tasks submitted',
        'Each outer task blocks on inner task',
      ],
      consequence: 'All workers blocked, system deadlocked.',
      technicalExplanation:
        'Nested submission to the same executor causes deadlock if all workers are occupied.',
      remediation: 'Use separate executor for inner tasks.',
      relatedSymbols: ['executor', 'future'],
      testToReproduce: {
        title: 'Deadlock test',
        setup: ['FixedThreadPool(2)'],
        steps: ['Submit 2 outer tasks that block on inner tasks.'],
        expectedResult: 'Deadlock after 2 tasks.',
      },
    },
  ],
  scorecard: {
    correctness: 4,
    concurrencySafety: 2,
    liveness: 2,
    errorHandling: 4,
    resourceManagement: 3,
    maintainability: 5,
    productionReadiness: 3,
  },
  verdict: {
    status: 'requires-major-changes',
    explanation: 'Critical concurrency defects must be fixed.',
  },
};

export async function POST(req: NextRequest) {
  try {
    // ===== 1. Rate Limiting =====
    const ip = getClientIP(req);
    const now = Date.now();
    const log = requestLog.get(ip);

    if (log) {
      if (now - log.firstRequest > TIME_WINDOW) {
        requestLog.set(ip, { count: 1, firstRequest: now });
      } else if (log.count >= MAX_REQUESTS_PER_IP) {
        return NextResponse.json(
          {
            error: `Too many requests. Maximum ${MAX_REQUESTS_PER_IP} requests per 24 hours.`,
          },
          { status: 429 }
        );
      } else {
        log.count += 1;
        requestLog.set(ip, log);
      }
    } else {
      requestLog.set(ip, { count: 1, firstRequest: now });
    }

    // ===== 2. Validate input =====
    const body: GenerateRequest = await req.json();
    const { code, language, mode } = body;

    if (!code || !language) {
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

    // ===== 3. Validate language =====
    if (!isSupportedLanguage(language)) {
      return NextResponse.json(
        {
          error: `Unsupported language: ${language}. Supported: ${SUPPORTED_LANGUAGES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // ===== 4. Code limits =====
    const lines = code.split('\n').length;
    if (lines > MAX_LINES_GENERATE) {
      return NextResponse.json(
        {
          error: `Code exceeds ${MAX_LINES_GENERATE} lines (${lines} lines). Please shorten your code.`,
        },
        { status: 400 }
      );
    }

    if (code.length > MAX_CODE_LENGTH) {
      return NextResponse.json(
        {
          error: `Code is too long (${code.length} characters). Maximum is ${MAX_CODE_LENGTH} characters.`,
        },
        { status: 400 }
      );
    }

    // ===== 5. Payload size limit =====
    const payloadSize = JSON.stringify(body).length;
    if (payloadSize > 100000) {
      return NextResponse.json(
        { error: 'Payload too large (max 100KB)' },
        { status: 413 }
      );
    }

    // ===== 6. Mock response for debugging =====
    if (process.env.USE_MOCK_RESPONSE === 'true' && mode === 'advanced') {
      return NextResponse.json(MOCK_RESPONSE);
    }

    // ===== 7. Execute AI =====
    let result: any;

    if (mode === 'advanced') {
      try {
        const pipelineResult = await runAdvancedPipeline(code, language);
        if (pipelineResult.result) {
          result = {
            ...pipelineResult.result,
            status: pipelineResult.status,
          };
        } else {
          console.warn(
            '[API] Advanced pipeline failed, falling back to legacy:',
            pipelineResult.error
          );
          result = await generateEducationalContent(code, language, mode);
        }
      } catch (pipelineError) {
        console.error('[API] Pipeline error, falling back to legacy:', pipelineError);
        result = await generateEducationalContent(code, language, mode);
      }
    } else {
      result = await generateEducationalContent(code, language, mode);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[API] AI Generation error:', error);
    }
    return NextResponse.json(
      { error: error.message || 'AI processing failed. Please try again.' },
      { status: 500 }
    );
  }
}