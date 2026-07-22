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
import fs from 'fs';
import path from 'path';

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

    const numberedCode = addLineNumbers(code);

    // ===== 2. Concurrency detection =====
    const stageStart2 = Date.now();
    const detectorResult: DetectorResult = detectConcurrencySignals(code, language);
    stages.push({ name: 'detect_concurrency', durationMs: Date.now() - stageStart2, data: detectorResult });

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

    // ============================================================
    // 📁 SAVE PROMPT TO FILE (Only in development environment)
    // ============================================================
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

    // ===== 4. First AI call =====
    const stageStart4 = Date.now();
    const systemPrompt = 'You are an expert code auditor. Return ONLY valid JSON. Do not use Markdown fences. Do not include any text before or after the JSON.';

    let rawContent: string;
    try {
      rawContent = await callOpenAI(systemPrompt, prompt, {
        mode: 'advanced',
        responseFormat: 'text',
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

    // ============================================================
    // 📁 SAVE RAW OPENAI RESPONSE TO FILE (Development only)
    // ============================================================
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

    // ===== 5. Extract JSON =====
    const stageStart5 = Date.now();
    const jsonString = extractJSON(rawContent);
    if (!jsonString) {
      logger.warn('[Pipeline] Failed to extract valid JSON from AI response');
      stages.push({ name: 'extract_json_failed', durationMs: Date.now() - stageStart5 });
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
          stages.push({ name: 'repair_success', durationMs: Date.now() - stageStart5 });
          return {
            result: repairResult,
            status: 'repaired',
            trace: { stages, rawAIResponse: rawContent },
          };
        }
      }
      return {
        result: null,
        status: 'failed_validation',
        error: 'Failed to extract valid JSON from AI response',
        trace: { stages, rawAIResponse: rawContent },
      };
    }
    stages.push({ name: 'extract_json', durationMs: Date.now() - stageStart5, data: { jsonLength: jsonString.length } });

    // ===== 6. Parse JSON =====
    const stageStart6 = Date.now();
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonString);
    } catch (parseError) {
      logger.warn('[Pipeline] JSON parse error:', parseError);
      stages.push({ name: 'parse_json_failed', durationMs: Date.now() - stageStart6, data: { error: parseError instanceof Error ? parseError.message : 'unknown' } });
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
          stages.push({ name: 'repair_success_after_parse_fail', durationMs: Date.now() - stageStart6 });
          return {
            result: repairResult,
            status: 'repaired',
            trace: { stages, rawAIResponse: rawContent, extractedJSON: jsonString },
          };
        }
      }
      return {
        result: null,
        status: 'failed_validation',
        error: `JSON parse failed: ${parseError instanceof Error ? parseError.message : 'unknown'}`,
        trace: { stages, rawAIResponse: rawContent, extractedJSON: jsonString },
      };
    }
    stages.push({ name: 'parse_json', durationMs: Date.now() - stageStart6, data: { parsed: true } });

    // ===== 7. Initial validation =====
    const stageStart7 = Date.now();
    let initialValidation = validateSemanticCompleteness(parsed, detectorResult, code);
    stages.push({ name: 'initial_validation', durationMs: Date.now() - stageStart7, data: { structurallyValid: initialValidation.structurallyValid, semanticallyComplete: initialValidation.semanticallyComplete, issuesCount: initialValidation.issues.length } });

    // ===== 8. Repair loop =====
    let lastCandidate = parsed;
    let lastValidation = initialValidation;
    let repairAttempts = 0;
    let wasRepaired = false;
    let finalCandidate: unknown = parsed;
    let finalValidation = initialValidation;

    while (lastValidation.repairRequired && repairAttempts < MAX_REPAIR_ATTEMPTS) {
      const stageStartRepair = Date.now();
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

    // ===== 9. Determine final outcome =====
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
          extractedJSON: jsonString,
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
          trace: { stages, rawAIResponse: rawContent, extractedJSON: jsonString },
        };
      }
    }

    logger.error('[Pipeline] Failed to obtain valid audit result');
    return {
      result: null,
      status: 'failed_validation',
      error: 'Validation failed after all repair attempts',
      trace: { stages, rawAIResponse: rawContent, extractedJSON: jsonString },
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