// lib/analysis/repair.ts

import { callOpenAI } from '@/lib/openaiClient';
import { buildRepairPrompt } from './prompts/repair';
import type { AdvancedAuditResult, AuditValidationResult } from './types';
import logger from '@/lib/logger';

// ===== Extract JSON from raw response (robust against extra text and control chars) =====
// 🔥 Same logic as in pipeline.ts to keep consistency
function extractJSON(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return text;
  // Extract content and remove invalid control characters
  return text.substring(start, end + 1).replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
}

export async function repairAudit(
  numberedCode: string,
  previousAudit: any, // 🔥 Changed from AdvancedAuditResult | null to any
  validationResult: AuditValidationResult,
  language: string,
  auditType: 'generic' | 'concurrency'
): Promise<AdvancedAuditResult | null> {
  // 🔥 Extract missing coverage from validation issues
  const missingCoverage: string[] = [];

  for (const issue of validationResult.issues) {
    if (issue.expectedCoverage && !missingCoverage.includes(issue.expectedCoverage)) {
      missingCoverage.push(issue.expectedCoverage);
    }
  }

  // 🔥 REMOVED: early return when no missing coverage and structurally valid
  // The pipeline decides when repair is needed, so we always attempt repair.

  const previousAuditJson = previousAudit ? JSON.stringify(previousAudit, null, 2) : '{}';

  const prompt = buildRepairPrompt(
    numberedCode,
    previousAuditJson,
    validationResult.issues,
    missingCoverage
  );

  try {
    const systemPrompt = 'You are an expert code auditor. Return only valid JSON.';

    // 🔥 Use 'text' response format to handle fences and control chars manually
    const content = await callOpenAI(systemPrompt, prompt, {
      mode: 'advanced',
      responseFormat: 'text',
    });

    // 🔥 Extract JSON using the same robust function as pipeline
    const extracted = extractJSON(content);

    // 🔥 Parse JSON, but do not validate with Zod here.
    // Let the pipeline handle final schema validation.
    const repaired = JSON.parse(extracted) as AdvancedAuditResult;

    // Ensure the required system fields are present
    return {
      ...repaired,
      schemaVersion: '1.0',
      status: 'repaired', // override status to repaired
    };
  } catch (error) {
    logger.error('[Repair] Repair failed:', error);
    return null;
  }
}