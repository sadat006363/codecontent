// lib/analysis/pipeline.ts

import { addLineNumbers, getLineCount } from './numberedCode';
import { detectConcurrencySignals } from './detector';
import { buildGenericAdvancedPrompt } from './prompts/generic';
import { buildConcurrencyAuditPrompt } from './prompts/concurrency';
import { validateSemanticCompleteness } from './validator';
import { repairAudit } from './repair';
import {
  AdvancedAuditResultSchema,
  type AdvancedAuditResult,
  type AuditStatus,
  type AuditType,
} from './schema';
import type { DetectorResult, AuditValidationResult } from './types';
import { ANALYSIS_CONFIG } from './analysis.config';
import { callOpenAI } from '@/lib/openaiClient';
import logger from '@/lib/logger';
import { z } from 'zod';

// ============================================================
// CONSTANTS
// ============================================================

const MAX_REPAIR_ATTEMPTS = ANALYSIS_CONFIG.maxRepairPasses;

// ============================================================
// HELPER: SAFE JSON EXTRACTION
// ============================================================

function extractJSON(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return '';
  const candidate = text.substring(start, end + 1);
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    const cleaned = candidate.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
    try {
      JSON.parse(cleaned);
      return cleaned;
    } catch {
      return '';
    }
  }
}

// ============================================================
// HELPER: FINALIZE AUDIT CANDIDATE (SINGLE ZOD GATE)
// ============================================================

function finalizeAuditCandidate(
  candidate: unknown,
  metadata: {
    status: AuditStatus;
    auditType: AuditType;
    language: string;
  }
):
  | { success: true; data: AdvancedAuditResult }
  | { success: false; issues: z.ZodIssue[] } {

  // Ensure candidate is a plain object
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    const issue = {
      code: 'invalid_type' as const,
      expected: 'object',
      received: typeof candidate,
      path: [],
      message: 'Candidate must be a non-null object',
    } as z.ZodIssue;
    return {
      success: false,
      issues: [issue],
    };
  }

  // Spread candidate and apply trusted metadata
  const payload: any = { ...candidate };
  payload.schemaVersion = '1.0';
  payload.auditType = metadata.auditType;
  payload.status = metadata.status;
  payload.language = metadata.language;

  // Validate with Zod
  const result = AdvancedAuditResultSchema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, issues: result.error.issues };
  }
}

// ============================================================
// HELPER: REPAIR WRAPPER (HONORS maxRepairAttempts)
// ============================================================

async function attemptRepairWithBudget(
  numberedCode: string,
  previousCandidate: unknown,
  validationResult: AuditValidationResult,
  language: string,
  auditType: AuditType,
  attemptNumber: number,
  maxAttempts: number
): Promise<AdvancedAuditResult | null> {
  if (attemptNumber >= maxAttempts) {
    logger.warn(`[Pipeline] Repair budget exhausted (${attemptNumber}/${maxAttempts})`);
    return null;
  }

  const previousJson = previousCandidate ? JSON.stringify(previousCandidate, null, 2) : '{}';

  try {
    const repaired = await repairAudit(
      numberedCode,
      previousJson,
      validationResult,
      language,
      auditType
    );

    if (!repaired) return null;

    // Re-validate the repaired result through the same gate
    const finalizeResult = finalizeAuditCandidate(repaired, {
      status: 'repaired',
      auditType,
      language,
    });

    if (finalizeResult.success) {
      return finalizeResult.data;
    } else {
      logger.warn(`[Pipeline] Repair attempt ${attemptNumber + 1} produced invalid schema, issues:`, finalizeResult.issues);
      return null;
    }
  } catch (err) {
    logger.error(`[Pipeline] Repair attempt ${attemptNumber + 1} threw:`, err);
    return null;
  }
}

// ============================================================
// MAIN PIPELINE
// ============================================================

export interface PipelineResult {
  result: AdvancedAuditResult | null;
  status: AuditStatus;
  error?: string;
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

    const numberedCode = addLineNumbers(code);

    // ===== 2. Concurrency detection =====
    const detectorResult: DetectorResult = detectConcurrencySignals(code, language);

    // ===== 3. Select audit strategy =====
    let auditType: AuditType;
    let prompt: string;

    if (detectorResult.requiresConcurrencyAudit) {
      prompt = buildConcurrencyAuditPrompt(numberedCode, language);
      auditType = 'concurrency';
      logger.info('[Pipeline] Concurrency audit selected');
    } else {
      prompt = buildGenericAdvancedPrompt(numberedCode, language);
      auditType = 'generic';
      logger.info('[Pipeline] Generic audit selected');
    }

    // ===== 4. First AI call =====
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
      logger.debug('[Pipeline] Raw AI response length:', rawContent.length);
    }

    // ===== 5. Extract JSON =====
    const jsonString = extractJSON(rawContent);
    if (!jsonString) {
      logger.warn('[Pipeline] Failed to extract valid JSON from AI response');
      // Try repair only if budget allows
      if (MAX_REPAIR_ATTEMPTS > 0) {
        const repairResult = await attemptRepairWithBudget(
          numberedCode,
          null,
          {
            structurallyValid: false,
            semanticallyComplete: false,
            issues: [
              {
                code: 'INVALID_JSON',
                severity: 'error',
                message: 'AI response did not contain valid JSON',
                relatedLines: [],
                expectedCoverage: 'Valid JSON matching AdvancedAuditResultSchema',
              },
            ],
            repairRequired: true,
          },
          language,
          auditType,
          0,
          MAX_REPAIR_ATTEMPTS
        );
        if (repairResult) {
          return {
            result: repairResult,
            status: 'repaired',
          };
        }
      }
      return {
        result: null,
        status: 'failed_validation',
        error: 'Failed to extract valid JSON from AI response',
      };
    }

    // ===== 6. Parse JSON =====
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseError) {
      logger.warn('[Pipeline] JSON parse error:', parseError);
      if (MAX_REPAIR_ATTEMPTS > 0) {
        const repairResult = await attemptRepairWithBudget(
          numberedCode,
          null,
          {
            structurallyValid: false,
            semanticallyComplete: false,
            issues: [
              {
                code: 'PARSE_FAILED',
                severity: 'error',
                message: `JSON parse failed: ${parseError instanceof Error ? parseError.message : 'unknown'}`,
                relatedLines: [],
                expectedCoverage: 'Valid JSON matching AdvancedAuditResultSchema',
              },
            ],
            repairRequired: true,
          },
          language,
          auditType,
          0,
          MAX_REPAIR_ATTEMPTS
        );
        if (repairResult) {
          return {
            result: repairResult,
            status: 'repaired',
          };
        }
      }
      return {
        result: null,
        status: 'failed_validation',
        error: `JSON parse failed: ${parseError instanceof Error ? parseError.message : 'unknown'}`,
      };
    }

    // ===== 7. Initial validation =====
    let initialValidation = validateSemanticCompleteness(parsed, detectorResult, code);

    // ===== 8. Repair loop (structured) =====
    let lastCandidate = parsed;
    let lastValidation = initialValidation;
    let repairAttempts = 0;
    let wasRepaired = false;
    let finalCandidate: unknown = parsed;
    let finalValidation = initialValidation;

    while (lastValidation.repairRequired && repairAttempts < MAX_REPAIR_ATTEMPTS) {
      logger.info(`[Pipeline] Repair attempt ${repairAttempts + 1} triggered`);
      const repaired = await attemptRepairWithBudget(
        numberedCode,
        lastCandidate,
        lastValidation,
        language,
        auditType,
        repairAttempts,
        MAX_REPAIR_ATTEMPTS
      );

      if (repaired) {
        // Repaired candidate passed the Zod gate -> structurally valid
        // Now re-run semantic validation
        const revalidation = validateSemanticCompleteness(repaired, detectorResult, code);
        if (revalidation.structurallyValid && !revalidation.repairRequired) {
          finalCandidate = repaired;
          finalValidation = revalidation;
          wasRepaired = true;
          break;
        } else if (revalidation.structurallyValid && revalidation.repairRequired) {
          // Partial: structurally valid but still semantically incomplete
          finalCandidate = repaired;
          finalValidation = revalidation;
          wasRepaired = true;
          // continue loop if budget remains
        } else {
          // Repaired but structurally invalid (shouldn't happen because Zod gate passed)
          logger.warn('[Pipeline] Repair produced structurally invalid data despite Zod pass');
          break;
        }
      } else {
        logger.warn('[Pipeline] Repair attempt failed');
        break;
      }
      repairAttempts++;
    }

    // ===== 9. Determine final outcome =====
    if (finalValidation.structurallyValid) {
      // finalCandidate already passed Zod gate via attemptRepairWithBudget or initial validation
      // We need to re-run the finalization to get a fully validated object
      const status: AuditStatus = wasRepaired ? 'repaired' : 'complete';
      const finalizeResult = finalizeAuditCandidate(finalCandidate, {
        status,
        auditType,
        language,
      });

      if (finalizeResult.success) {
        const duration = Date.now() - startTime;
        logger.info(`[Pipeline] Completed in ${duration}ms, status: ${status}`);
        return {
          result: finalizeResult.data,
          status,
        };
      } else {
        logger.error('[Pipeline] Finalization failed despite structural validity:', finalizeResult.issues);
        return {
          result: null,
          status: 'failed_validation',
          error: 'Internal error: final validation failed unexpectedly',
        };
      }
    }

    // ===== 10. All attempts exhausted or validation failed =====
    logger.error('[Pipeline] Failed to obtain valid audit result');
    return {
      result: null,
      status: 'failed_validation',
      error: 'Validation failed after all repair attempts',
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