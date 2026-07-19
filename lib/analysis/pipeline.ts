// ============================================================
// 📁 فایل: lib/analysis/pipeline.ts
// ============================================================
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
import { callOpenAI, callOpenAIJson } from '@/lib/openaiClient';
import logger from '@/lib/logger';

export interface PipelineResult {
  result: AdvancedAuditResult | null;
  status: AuditStatus;
  error?: string;
}

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
  const startTime = Date.now();

  try {
    const lineCount = getLineCount(code);
    if (lineCount > ANALYSIS_CONFIG.maxLinesForAnalysis) {
      logger.warn(`[Pipeline] Code exceeds max lines: ${lineCount} > ${ANALYSIS_CONFIG.maxLinesForAnalysis}`);
      return {
        result: null,
        status: 'failed_validation',
        error: `Code exceeds maximum ${ANALYSIS_CONFIG.maxLinesForAnalysis} lines (${lineCount} lines).`,
      };
    }

    const numberedCode = addLineNumbers(code);
    const detectorResult = detectConcurrencySignals(code, language);

    let prompt: string;
    let auditType: 'generic' | 'concurrency';

    if (detectorResult.requiresConcurrencyAudit) {
      prompt = buildConcurrencyAuditPrompt(numberedCode, language);
      auditType = 'concurrency';
      logger.info('[Pipeline] Concurrency audit selected');
    } else {
      prompt = buildGenericAdvancedPrompt(numberedCode, language);
      auditType = 'generic';
      logger.info('[Pipeline] Generic audit selected');
    }

    const systemPrompt =
      'You are an expert code auditor. Return ONLY valid JSON. Do not use Markdown fences. Do not include any text before or after the JSON.';

    let rawContent: string;
    try {
      rawContent = await callOpenAI(systemPrompt, prompt, {
        mode: 'advanced',
        responseFormat: 'text',
      });
    } catch (aiError) {
      logger.error('[Pipeline] AI call failed:', aiError);
      return {
        result: null,
        status: 'failed_validation',
        error: aiError instanceof Error ? aiError.message : 'AI call failed',
      };
    }

    if (process.env.NODE_ENV === 'development') {
      logger.info('[Pipeline] Raw AI response length:', rawContent.length);
    }

    const jsonString = extractJSON(rawContent);
    let parsed: AdvancedAuditResult;

    try {
      parsed = AdvancedAuditResultSchema.parse(JSON.parse(jsonString));
    } catch (parseError) {
      logger.warn('[Pipeline] Initial parse failed, attempting repair');

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
        logger.info('[Pipeline] Repair succeeded after parse failure');
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

    const normalized = normalizeAnalysisOutput(parsed);
    const validationResult = validateSemanticCompleteness(normalized, detectorResult, code);

    if (validationResult.repairRequired) {
      logger.info('[Pipeline] Validation failed, attempting repair');

      const repaired = await repairAudit(
        numberedCode,
        normalized,
        validationResult,
        language,
        auditType
      );

      if (repaired) {
        const revalidated = validateSemanticCompleteness(repaired, detectorResult, code);
        if (revalidated.structurallyValid && revalidated.semanticallyComplete) {
          logger.info('[Pipeline] Repair successful, status: repaired');
          return {
            result: { ...repaired, status: 'repaired' },
            status: 'repaired',
          };
        } else {
          logger.warn('[Pipeline] Partial repair, status: partially_complete');
          return {
            result: { ...repaired, status: 'partially_complete' },
            status: 'partially_complete',
          };
        }
      } else {
        logger.warn('[Pipeline] Repair failed, returning partial result');
        return {
          result: { ...normalized, status: 'partially_complete' },
          status: 'partially_complete',
        };
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`[Pipeline] Complete in ${duration}ms`);

    return {
      result: { ...normalized, status: 'complete' },
      status: 'complete',
    };
  } catch (error) {
    logger.error('[Pipeline] Unhandled error:', error);
    return {
      result: null,
      status: 'failed_validation',
      error: error instanceof Error ? error.message : 'Unknown pipeline error',
    };
  }
}