// lib/analysis/pipeline.ts
import { addLineNumbers, getLineCount } from './numberedCode';
import { detectConcurrencySignals } from './detector';
import { buildGenericAdvancedPrompt } from './prompts/generic';
import { buildConcurrencyAuditPrompt } from './prompts/concurrency';
import { validateSemanticCompleteness } from './validator';
import { repairAudit } from './repair';
import { normalizeAnalysisOutput } from './normalizer';
import { AdvancedAuditResult, AuditStatus } from './types';
import { AdvancedAuditResultSchema } from './schema';
import { ANALYSIS_CONFIG } from './config';
import OpenAI from 'openai';

const openaiApiKey = process.env.OPENAI_API_KEY || 'placeholder-key';
const openai = new OpenAI({ apiKey: openaiApiKey });

export interface PipelineResult {
  result: AdvancedAuditResult | null;
  status: AuditStatus;
  error?: string;
}

// ===== Extract JSON from raw response (remove markdown code blocks) =====
function extractJSON(text: string): string {
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return cleaned;
  return cleaned.substring(start, end + 1);
}

export async function runAdvancedPipeline(
  code: string,
  language: string
): Promise<PipelineResult> {
  try {
    // ===== 1. Input validation =====
    const lineCount = getLineCount(code);
    if (lineCount > ANALYSIS_CONFIG.maxLinesForAnalysis) {
      return {
        result: null,
        status: 'failed_validation',
        error: `Code exceeds maximum ${ANALYSIS_CONFIG.maxLinesForAnalysis} lines (${lineCount} lines).`,
      };
    }

    // ===== 2. Add line numbers =====
    const numberedCode = addLineNumbers(code);

    // ===== 3. Concurrency signal detection =====
    const detectorResult = detectConcurrencySignals(code, language);

    // ===== 4. Select audit strategy =====
    let prompt: string;
    let auditType: 'generic' | 'concurrency';

    if (detectorResult.requiresConcurrencyAudit) {
      prompt = buildConcurrencyAuditPrompt(numberedCode, language);
      auditType = 'concurrency';
    } else {
      prompt = buildGenericAdvancedPrompt(numberedCode, language);
      auditType = 'generic';
    }

    // ===== 5. First AI call =====
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    const response = await openai.chat.completions.create(
      {
        model: process.env.OPENAI_MODEL_ADVANCED || 'gpt-4o',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert code auditor. Return ONLY valid JSON. Do not use Markdown fences. Do not include any text before or after the JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
        max_tokens: 16000,
      },
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    const rawContent = response.choices[0].message.content || '{}';

    // ===== Log raw response for debugging =====
    if (process.env.NODE_ENV === 'development') {
      console.log('[Pipeline] Raw AI response:', rawContent);
    }

    // ===== Extract and parse JSON =====
    const jsonString = extractJSON(rawContent);
    let parsed: AdvancedAuditResult;

    try {
      parsed = AdvancedAuditResultSchema.parse(JSON.parse(jsonString));
    } catch (parseError) {
      // Try repair with minimal context
      const repairResult = await repairAudit(
        numberedCode,
        null,
        {
          structurallyValid: false,
          semanticallyComplete: false,
          issues: [
            {
              code: 'INITIAL_PARSE_FAILED',
              severity: 'error',
              message: 'Failed to parse initial response',
              relatedLines: [],
              expectedCoverage: 'Valid JSON matching schema',
            },
          ],
          repairRequired: true,
        },
        language,
        auditType
      );

      if (repairResult) {
        return {
          result: { ...repairResult, status: 'repaired' },
          status: 'repaired',
        };
      }

      return {
        result: null,
        status: 'failed_validation',
        error: 'Failed to parse and repair AI response',
      };
    }

    // ===== 6. Normalize output (handle different schemas) =====
    const normalized = normalizeAnalysisOutput(parsed);

    // ===== 7. Semantic validation =====
    const validationResult = validateSemanticCompleteness(
      normalized,
      detectorResult,
      code
    );

    // ===== 8. Repair if needed (max 1 pass) =====
    if (validationResult.repairRequired) {
      const repaired = await repairAudit(
        numberedCode,
        normalized,
        validationResult,
        language,
        auditType
      );

      if (repaired) {
        const revalidated = validateSemanticCompleteness(
          repaired,
          detectorResult,
          code
        );

        if (revalidated.structurallyValid && revalidated.semanticallyComplete) {
          return {
            result: { ...repaired, status: 'repaired' },
            status: 'repaired',
          };
        } else {
          return {
            result: { ...repaired, status: 'partially_complete' },
            status: 'partially_complete',
          };
        }
      } else {
        return {
          result: { ...normalized, status: 'partially_complete' },
          status: 'partially_complete',
        };
      }
    }

    // ===== 9. Complete =====
    return {
      result: { ...normalized, status: 'complete' },
      status: 'complete',
    };
  } catch (error) {
    console.error('[Pipeline] Pipeline error:', error);
    return {
      result: null,
      status: 'failed_validation',
      error: error instanceof Error ? error.message : 'Unknown pipeline error',
    };
  }
}