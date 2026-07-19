// ============================================================
// 📁 فایل: lib/analysis/repair.ts
// ============================================================
import { callOpenAI } from '@/lib/openaiClient';
import { buildRepairPrompt } from './prompts/repair';
import { AdvancedAuditResult, AuditValidationResult } from './types';
import { AdvancedAuditResultSchema } from './schema';
import logger from '@/lib/logger';

export async function repairAudit(
  numberedCode: string,
  previousAudit: AdvancedAuditResult | null,
  validationResult: AuditValidationResult,
  language: string,
  auditType: 'generic' | 'concurrency'
): Promise<AdvancedAuditResult | null> {
  const missingCoverage: string[] = [];

  for (const issue of validationResult.issues) {
    if (issue.expectedCoverage && !missingCoverage.includes(issue.expectedCoverage)) {
      missingCoverage.push(issue.expectedCoverage);
    }
  }

  if (missingCoverage.length === 0 && validationResult.structurallyValid) {
    return previousAudit;
  }

  const previousAuditJson = previousAudit ? JSON.stringify(previousAudit, null, 2) : '{}';

  const prompt = buildRepairPrompt(
    numberedCode,
    previousAuditJson,
    validationResult.issues,
    missingCoverage
  );

  try {
    const systemPrompt = 'You are an expert code auditor. Return only valid JSON.';
    
    const content = await callOpenAI(systemPrompt, prompt, {
      mode: 'advanced',
      responseFormat: 'json_object',
    });

    const repaired = JSON.parse(content);
    const parsed = AdvancedAuditResultSchema.parse(repaired);
    return parsed as AdvancedAuditResult;
  } catch (error) {
    logger.error('[Repair] Repair failed:', error);
    return null;
  }
}