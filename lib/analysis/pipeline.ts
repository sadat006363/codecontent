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
import { normalizeAnalysisOutput } from './normalizer';
import logger from '@/lib/logger';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

// ============================================================
// CONSTANTS
// ============================================================

const MAX_REPAIR_ATTEMPTS = ANALYSIS_CONFIG.maxRepairPasses;
const PIPELINE_DEADLINE_MS = parseInt(process.env.PIPELINE_DEADLINE_MS || '180000', 10); // 3 دقیقه

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
// HELPER: FINALIZE AUDIT CANDIDATE
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

  const payload: any = { ...candidate };
  payload.schemaVersion = '1.0';
  payload.auditType = metadata.auditType;
  payload.status = metadata.status;
  payload.language = metadata.language;

  const result = AdvancedAuditResultSchema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, issues: result.error.issues };
  }
}

// ============================================================
// HELPER: REPAIR WRAPPER
// ============================================================

async function attemptRepairWithBudget(
  numberedCode: string,
  previousCandidate: unknown,
  validationResult: AuditValidationResult,
  language: string,
  auditType: AuditType,
  attemptNumber: number,
  maxAttempts: number,
  deadline: number
): Promise<AdvancedAuditResult | null> {
  if (attemptNumber >= maxAttempts) {
    logger.warn(`[Pipeline] Repair budget exhausted (${attemptNumber}/${maxAttempts})`);
    return null;
  }

  // ===== بررسی Deadline =====
  if (Date.now() > deadline) {
    logger.warn('[Pipeline] Deadline reached during repair');
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
// MAIN PIPELINE (با Deadline)
// ============================================================

export interface PipelineResult {
  result: AdvancedAuditResult | null;
  status: AuditStatus;
  error?: string;
  trace?: {
    requestPayload?: unknown;
    rawAIResponse?: string;
    extractedJSON?: string;
    validatedData?: unknown;
    repairedData?: unknown;
    normalizedData?: unknown;
    finalData?: unknown;
    stages: {
      name: string;
      durationMs: number;
      data?: unknown;
    }[];
  };
}

export async function runAdvancedPipeline(
  code: string,
  language: string
): Promise<PipelineResult> {
  const startTime = Date.now();
  const deadline = startTime + PIPELINE_DEADLINE_MS;
  const stages: { name: string; durationMs: number; data?: unknown }[] = [];

  try {
    // ===== 1. Input validation =====
    const stageStart = Date.now();
    const lineCount = getLineCount(code);
    if (lineCount > ANALYSIS_CONFIG.maxLinesForAnalysis) {
      logger.warn(`[Pipeline] Code exceeds max lines: ${lineCount} > ${ANALYSIS_CONFIG.maxLinesForAnalysis}`);
      stages.push({ name: 'input_validation', durationMs: Date.now() - stageStart, data: { lineCount, maxAllowed: ANALYSIS_CONFIG.maxLinesForAnalysis } });
      return {
        result: null,
        status: 'failed_validation',
        error: `Code exceeds maximum ${ANALYSIS_CONFIG.maxLinesForAnalysis} lines (${lineCount} lines).`,
        trace: { stages },
      };
    }
    stages.push({ name: 'input_validation', durationMs: Date.now() - stageStart });

    // ===== بررسی Deadline =====
    if (Date.now() > deadline) {
      logger.warn('[Pipeline] Deadline reached at input validation');
      return {
        result: null,
        status: 'failed_validation',
        error: 'Pipeline deadline exceeded',
        trace: { stages },
      };
    }

    const numberedCode = addLineNumbers(code);

    // ===== 2. Concurrency detection =====
    const stageStart2 = Date.now();
    const detectorResult: DetectorResult = detectConcurrencySignals(code, language);
    stages.push({ name: 'detect_concurrency', durationMs: Date.now() - stageStart2, data: detectorResult });

    if (Date.now() > deadline) {
      logger.warn('[Pipeline] Deadline reached after concurrency detection');
      return {
        result: null,
        status: 'failed_validation',
        error: 'Pipeline deadline exceeded',
        trace: { stages },
      };
    }

    // ===== 3. Select audit strategy =====
    const stageStart3 = Date.now();
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
    stages.push({ name: 'select_strategy', durationMs: Date.now() - stageStart3, data: { auditType } });

    // ===== Save prompt in development =====
    if (process.env.NODE_ENV === 'development') {
      try {
        const debugDir = path.join(process.cwd(), 'debug');
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `prompt-${auditType}-${timestamp}.md`;
        const filePath = path.join(debugDir, fileName);

        const systemPrompt = 'You are an expert code auditor. Return ONLY valid JSON. Do not use Markdown fences. Do not include any text before or after the JSON.';

        const content = [
          `# Prompt sent to OpenAI (${auditType})`,
          `## Timestamp: ${new Date().toISOString()}`,
          `## Language: ${language}`,
          `## Audit Type: ${auditType}`,
          '',
          '## System Prompt',
          '```',
          systemPrompt,
          '```',
          '',
          '## User Prompt',
          '```',
          prompt,
          '```',
          '',
          '## Code Context',
          '```',
          `Total lines: ${lineCount}`,
          '```',
        ].join('\n');

        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`📄 Prompt saved to: ${filePath}`);
      } catch (err) {
        console.warn('⚠️ Failed to save debug prompt:', err);
      }
    }

    if (Date.now() > deadline) {
      logger.warn('[Pipeline] Deadline reached before AI call');
      return {
        result: null,
        status: 'failed_validation',
        error: 'Pipeline deadline exceeded',
        trace: { stages },
      };
    }

    // ===== 4. First AI call =====
    const stageStart4 = Date.now();
    const systemPrompt = 'You are an expert code auditor. Return ONLY valid JSON. Do not use Markdown fences. Do not include any text before or after the JSON.';

    let rawContent: string;
    try {
      // ===== ارسال deadline به callOpenAI =====
      const remainingMs = deadline - Date.now();
      rawContent = await callOpenAI(systemPrompt, prompt, {
        mode: 'advanced',
        responseFormat: 'text',
        timeout: Math.min(remainingMs - 5000, 90000),
      });
    } catch (aiError) {
      logger.error('[Pipeline] AI call failed:', aiError);
      stages.push({ name: 'ai_call_failed', durationMs: Date.now() - stageStart4, data: { error: aiError instanceof Error ? aiError.message : 'unknown' } });
      return {
        result: null,
        status: 'failed_validation',
        error: aiError instanceof Error ? aiError.message : 'AI call failed',
        trace: { stages },
      };
    }
    stages.push({ name: 'ai_call', durationMs: Date.now() - stageStart4 });

    // ===== Save raw response in development =====
    if (process.env.NODE_ENV === 'development') {
      try {
        const debugDir = path.join(process.cwd(), 'debug');
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `response-${auditType}-${timestamp}.json`;
        const filePath = path.join(debugDir, fileName);

        const content = JSON.stringify({
          timestamp: new Date().toISOString(),
          auditType,
          language,
          rawResponse: rawContent,
        }, null, 2);

        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`📄 Raw OpenAI response saved to: ${filePath}`);
      } catch (err) {
        console.warn('⚠️ Failed to save raw response:', err);
      }
    }

    if (Date.now() > deadline) {
      logger.warn('[Pipeline] Deadline reached after AI call');
      return {
        result: null,
        status: 'failed_validation',
        error: 'Pipeline deadline exceeded',
        trace: { stages },
      };
    }

    // ===== 5. Normalize =====
    let normalizedData: AdvancedAuditResult | null = null;
    let normalizationError: string | null = null;
    let jsonString: string | null = null;

    try {
      jsonString = extractJSON(rawContent);
      if (!jsonString) {
        throw new Error('Failed to extract JSON from AI response');
      }

      const parsed = JSON.parse(jsonString);
      normalizedData = normalizeAnalysisOutput(parsed);
    } catch (normError) {
      normalizationError = normError instanceof Error ? normError.message : 'Normalization failed';
      logger.warn('[Pipeline] Normalization failed:', normError);
    }

    if (Date.now() > deadline) {
      logger.warn('[Pipeline] Deadline reached during normalization');
      return {
        result: null,
        status: 'failed_validation',
        error: 'Pipeline deadline exceeded',
        trace: { stages },
      };
    }

    // ===== 6. Validation & Repair =====
    if (normalizedData) {
      const zodResult = AdvancedAuditResultSchema.safeParse(normalizedData);
      if (zodResult.success) {
        stages.push({ name: 'normalization_success', durationMs: Date.now() - stageStart4 });

        let initialValidation = validateSemanticCompleteness(zodResult.data, detectorResult, code);

        let lastCandidate = zodResult.data;
        let lastValidation = initialValidation;
        let repairAttempts = 0;
        let wasRepaired = false;
        let finalCandidate: unknown = zodResult.data;
        let finalValidation = initialValidation;

        while (lastValidation.repairRequired && repairAttempts < MAX_REPAIR_ATTEMPTS) {
          if (Date.now() > deadline) {
            logger.warn('[Pipeline] Deadline reached during repair loop');
            break;
          }

          const stageStartRepair = Date.now();
          logger.info(`[Pipeline] Repair attempt ${repairAttempts + 1} triggered`);
          const repaired = await attemptRepairWithBudget(
            numberedCode,
            lastCandidate,
            lastValidation,
            language,
            auditType,
            repairAttempts,
            MAX_REPAIR_ATTEMPTS,
            deadline
          );

          if (repaired) {
            const revalidation = validateSemanticCompleteness(repaired, detectorResult, code);
            if (revalidation.structurallyValid && !revalidation.repairRequired) {
              finalCandidate = repaired;
              finalValidation = revalidation;
              wasRepaired = true;
              stages.push({ name: 'repair_success', durationMs: Date.now() - stageStartRepair, data: { attempt: repairAttempts + 1 } });
              break;
            } else if (revalidation.structurallyValid && revalidation.repairRequired) {
              finalCandidate = repaired;
              finalValidation = revalidation;
              wasRepaired = true;
              stages.push({ name: 'repair_partial', durationMs: Date.now() - stageStartRepair, data: { attempt: repairAttempts + 1, issuesCount: revalidation.issues.length } });
            } else {
              logger.warn('[Pipeline] Repair produced structurally invalid data despite Zod pass');
              stages.push({ name: 'repair_invalid', durationMs: Date.now() - stageStartRepair, data: { attempt: repairAttempts + 1 } });
              break;
            }
          } else {
            logger.warn('[Pipeline] Repair attempt failed');
            stages.push({ name: 'repair_failed', durationMs: Date.now() - stageStartRepair, data: { attempt: repairAttempts + 1 } });
            break;
          }
          repairAttempts++;
        }

        if (finalValidation.structurallyValid) {
          const status: AuditStatus = wasRepaired ? 'repaired' : 'complete';
          const finalizeResult = finalizeAuditCandidate(finalCandidate, {
            status,
            auditType,
            language,
          });

          if (finalizeResult.success) {
            const duration = Date.now() - startTime;
            logger.info(`[Pipeline] Completed in ${duration}ms, status: ${status}`);
            const trace = {
              stages,
              rawAIResponse: rawContent,
              extractedJSON: jsonString || '',
              finalData: finalizeResult.data,
            };
            return {
              result: finalizeResult.data,
              status,
              trace,
            };
          } else {
            logger.error('[Pipeline] Finalization failed despite structural validity:', finalizeResult.issues);
            return {
              result: null,
              status: 'failed_validation',
              error: 'Internal error: final validation failed unexpectedly',
              trace: { stages, rawAIResponse: rawContent, extractedJSON: jsonString || '' },
            };
          }
        }
      } else {
        logger.warn('[Pipeline] Zod validation failed even after normalization:', zodResult.error.issues);
        if (MAX_REPAIR_ATTEMPTS > 0 && Date.now() < deadline) {
          const repairResult = await attemptRepairWithBudget(
            numberedCode,
            normalizedData,
            {
              structurallyValid: false,
              semanticallyComplete: false,
              issues: zodResult.error.issues.map((issue) => ({
                code: 'ZOD_VALIDATION_FAILED',
                severity: 'error',
                message: `${issue.path.join('.')}: ${issue.message}`,
                relatedLines: [],
                expectedCoverage: 'Valid JSON matching AdvancedAuditResultSchema',
              })),
              repairRequired: true,
            },
            language,
            auditType,
            0,
            MAX_REPAIR_ATTEMPTS,
            deadline
          );
          if (repairResult) {
            stages.push({ name: 'repair_success_after_normalization', durationMs: Date.now() - stageStart4 });
            return {
              result: repairResult,
              status: 'repaired',
              trace: { stages, rawAIResponse: rawContent, extractedJSON: jsonString || '' },
            };
          }
        }
      }
    }

    // ===== 7. Final fallback =====
    if (MAX_REPAIR_ATTEMPTS > 0 && jsonString && Date.now() < deadline) {
      try {
        const parsed = JSON.parse(jsonString);
        const repairResult = await attemptRepairWithBudget(
          numberedCode,
          parsed,
          {
            structurallyValid: false,
            semanticallyComplete: false,
            issues: [
              {
                code: 'NORMALIZATION_FAILED',
                severity: 'error',
                message: normalizationError || 'Normalization failed',
                relatedLines: [],
                expectedCoverage: 'Valid JSON matching AdvancedAuditResultSchema',
              },
            ],
            repairRequired: true,
          },
          language,
          auditType,
          0,
          MAX_REPAIR_ATTEMPTS,
          deadline
        );
        if (repairResult) {
          stages.push({ name: 'repair_success_after_normalization_failure', durationMs: Date.now() - stageStart4 });
          return {
            result: repairResult,
            status: 'repaired',
            trace: { stages, rawAIResponse: rawContent, extractedJSON: jsonString || '' },
          };
        }
      } catch (parseError) {
        logger.warn('[Pipeline] Failed to parse JSON for repair:', parseError);
      }
    }

    // ===== 8. All failed =====
    logger.error('[Pipeline] Failed to obtain valid audit result');
    return {
      result: null,
      status: 'failed_validation',
      error: normalizationError || 'Failed to produce valid audit result',
      trace: { stages, rawAIResponse: rawContent, extractedJSON: jsonString || '' },
    };
  } catch (error) {
    logger.error('[Pipeline] Unhandled error:', error);
    return {
      result: null,
      status: 'failed_validation',
      error: error instanceof Error ? error.message : 'Unknown pipeline error',
      trace: { stages },
    };
  }
}