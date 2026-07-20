// lib/analysis/pipeline.ts

import { addLineNumbers, getLineCount } from './numberedCode';
import { detectConcurrencySignals } from './detector';
import { buildGenericAdvancedPrompt } from './prompts/generic';
import { buildConcurrencyAuditPrompt } from './prompts/concurrency';
import { validateSemanticCompleteness } from './validator';
import { repairAudit } from './repair';
import { normalizeAnalysisOutput } from './normalizer';
import { AdvancedAuditResultSchema, type AdvancedAuditResult } from './schema';
import type { AuditStatus, DetectorResult, AuditValidationResult } from './types';
import { ANALYSIS_CONFIG } from './config';
import { callOpenAI } from '@/lib/openaiClient';
import logger from '@/lib/logger';

// Maximum repair attempts (strictly limited to 1 for MVP)
const MAX_REPAIR_ATTEMPTS = 1;

export interface PipelineResult {
  result: AdvancedAuditResult | null;
  status: AuditStatus;
  error?: string;
}

// ===== Extract JSON from raw response (robust against extra text and control chars) =====
function extractJSON(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return text;
  // Extract content and remove invalid control characters (except newlines within strings)
  return text.substring(start, end + 1).replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
}

export async function runAdvancedPipeline(
  code: string,
  language: string
): Promise<PipelineResult> {
  const startTime = Date.now();

  try {
    // ===== 1. Input validation =====
    const lineCount = getLineCount(code);
    if (lineCount > ANALYSIS_CONFIG.maxLinesForAnalysis) {
      logger.warn(`[Pipeline] Code exceeds max lines: ${lineCount} > ${ANALYSIS_CONFIG.maxLinesForAnalysis}`);
      return {
        result: null,
        status: 'failed_validation',
        error: `Code exceeds maximum ${ANALYSIS_CONFIG.maxLinesForAnalysis} lines (${lineCount} lines).`,
      };
    }

    // ===== 2. Add line numbers =====
    const numberedCode = addLineNumbers(code);

    // ===== 3. Concurrency signal detection =====
    const detectorResult: DetectorResult = detectConcurrencySignals(code, language);

    // ===== 4. Select audit strategy =====
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

    // ===== 5. First AI call =====
    const systemPrompt =
      'You are an expert code auditor. Return ONLY valid JSON. Do not use Markdown fences. Do not include any text before or after the JSON.';

    let rawContent: string;
    try {
      rawContent = await callOpenAI(systemPrompt, prompt, {
        mode: 'advanced',
        responseFormat: 'text', // we want raw text to handle fences manually
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

    // ===== 6. Extract and parse JSON =====
    const jsonString = extractJSON(rawContent);
    let parsed: any;
    let parseError: Error | null = null;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      parseError = e instanceof Error ? e : new Error(String(e));
      logger.warn('[Pipeline] JSON parse failed:', parseError.message);
      // Attempt repair with minimal context
      const repairResult = await attemptRepair(
        numberedCode,
        null, // no previous audit
        {
          structurallyValid: false,
          semanticallyComplete: false,
          issues: [
            {
              code: 'INITIAL_PARSE_FAILED',
              severity: 'error',
              message: `Failed to parse initial JSON: ${parseError.message}`,
              relatedLines: [],
              expectedCoverage: 'Valid JSON matching AdvancedAuditResultSchema',
            },
          ],
          repairRequired: true,
        } as AuditValidationResult,
        language,
        auditType,
        0 // attempt number
      );

      if (repairResult) {
        return {
          result: { ...repairResult, status: 'repaired' },
          status: 'repaired',
        };
      } else {
        return {
          result: null,
          status: 'failed_validation',
          error: `Failed to parse AI response: ${parseError.message}`,
        };
      }
    }

    // ===== 7. First validation =====
    let validationResult = validateSemanticCompleteness(parsed, detectorResult, code);

    // ===== 8. Repair if needed (max 1 attempt) =====
    let repairAttempts = 0;
    let finalResult = parsed;
    let finalValidation = validationResult;

    while (
      finalValidation.repairRequired &&
      repairAttempts < MAX_REPAIR_ATTEMPTS
    ) {
      logger.info(`[Pipeline] Repair attempt ${repairAttempts + 1} triggered`);
      const repaired = await attemptRepair(
        numberedCode,
        finalResult,
        finalValidation,
        language,
        auditType,
        repairAttempts
      );

      if (repaired) {
        // Re-validate the repaired result
        const revalidation = validateSemanticCompleteness(repaired, detectorResult, code);
        if (revalidation.structurallyValid && !revalidation.repairRequired) {
          // Repair succeeded
          finalResult = { ...repaired, status: 'repaired' };
          finalValidation = revalidation;
          break;
        } else {
          // Repair partially succeeded but still has issues
          finalResult = { ...repaired, status: 'partially_complete' };
          finalValidation = revalidation;
          // We might still have repairRequired, but we'll exit loop if attempts exhausted
        }
      } else {
        // Repair failed completely
        logger.error('[Pipeline] Repair attempt failed');
        break;
      }
      repairAttempts++;
    }

    // ===== 9. Determine final outcome =====
    if (finalValidation.structurallyValid && !finalValidation.repairRequired) {
      // Full success
      const status: AuditStatus = repairAttempts > 0 ? 'repaired' : 'complete';
      try {
        const result = AdvancedAuditResultSchema.parse({
          ...finalResult,
          status,
          auditType,
          schemaVersion: '1.0',
        });
        const duration = Date.now() - startTime;
        logger.info(`[Pipeline] Complete in ${duration}ms, status: ${status}`);
        return { result, status };
      } catch (schemaError) {
        // If final schema validation fails, treat as failed validation
        logger.error('[Pipeline] Final schema validation failed:', schemaError);
        return {
          result: null,
          status: 'failed_validation',
          error: `Final schema validation failed: ${schemaError instanceof Error ? schemaError.message : 'unknown error'}`,
        };
      }
    } else if (finalValidation.structurallyValid && finalValidation.repairRequired) {
      // Partial success: repair did not fix all issues, but structure is valid
      const status: AuditStatus = 'partially_complete';
      try {
        const result = AdvancedAuditResultSchema.parse({
          ...finalResult,
          status,
          auditType,
          schemaVersion: '1.0',
        });
        logger.warn('[Pipeline] Partial completion with remaining issues');
        return { result, status };
      } catch (schemaError) {
        logger.error('[Pipeline] Schema validation failed for partial result:', schemaError);
        return {
          result: null,
          status: 'failed_validation',
          error: `Schema validation failed for partial result: ${schemaError instanceof Error ? schemaError.message : 'unknown error'}`,
        };
      }
    } else {
      // Failed validation even after repair
      logger.error('[Pipeline] Final validation failed');
      return {
        result: null,
        status: 'failed_validation',
        error: 'Validation failed after all repair attempts',
      };
    }
  } catch (error) {
    logger.error('[Pipeline] Unhandled error:', error);
    return {
      result: null,
      status: 'failed_validation',
      error: error instanceof Error ? error.message : 'Unknown pipeline error',
    };
  }
}

// ============================================================
// Helper: attempt repair (with attempt tracking)
// ============================================================

async function attemptRepair(
  numberedCode: string,
  previousAudit: any,
  validationResult: AuditValidationResult,
  language: string,
  auditType: 'generic' | 'concurrency',
  attempt: number
): Promise<AdvancedAuditResult | null> {
  try {
    const previousAuditJson = previousAudit ? JSON.stringify(previousAudit, null, 2) : '{}';
    const repaired = await repairAudit(
      numberedCode,
      previousAuditJson,
      validationResult,
      language,
      auditType
    );
    if (repaired) {
      // Ensure schemaVersion and status are set correctly
      // Cast to any to avoid TypeScript literal type conflicts
      return {
        ...repaired,
        schemaVersion: '1.0',
        status: 'repaired',
      } as any;
    }
    return null;
  } catch (err) {
    logger.error(`[Pipeline] Repair attempt ${attempt + 1} failed with error:`, err);
    return null;
  }
}