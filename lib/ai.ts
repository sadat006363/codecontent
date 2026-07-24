// lib/ai.ts

import { callOpenAIJson } from './openaiClient';
import logger from './logger';
import type { LegacyGenerateResponse } from '@/types';
import { getBaseSystemInstructions } from './analysis/prompts/base';

// ============================================================
// 1. Prompt builders for each mode
// ============================================================

function buildSimplePrompt(code: string, language: string): string {
  return `
${getBaseSystemInstructions()}

You are a friendly programming mentor. Provide a simple, high-level explanation of the following code.
Focus on:
- What the code does overall.
- Key concepts.
- Any obvious issues or improvements.

Code (${language}):
${code}

Return your analysis as a plain text (not JSON).
`;
}

function buildMediumPrompt(code: string, language: string): string {
  return `
${getBaseSystemInstructions()}

You are a senior developer. Provide a detailed analysis of the following code.
Include:
- A high-level summary.
- Key components and their responsibilities.
- Potential bugs, edge cases, and performance concerns.
- Suggestions for improvement.

Code (${language}):
${code}

Return your analysis as a plain text (not JSON).
`;
}

function buildAdvancedPrompt(code: string, language: string): string {
  return `
${getBaseSystemInstructions()}

You are a Staff Engineer and code auditor. Provide a comprehensive analysis of the following code.
Use the canonical AdvancedAuditResult schema (JSON).

Code (${language}):
${code}

Return valid JSON that matches the AdvancedAuditResult schema.
`;
}

// ============================================================
// 2. Main generation function (returns legacy shape for now)
// ============================================================

export async function generateEducationalContent(
  code: string,
  language: string,
  mode: 'simple' | 'medium' | 'advanced'
): Promise<LegacyGenerateResponse> {
  logger.info(`[ai] Generating ${mode} analysis for ${language}`);

  let systemPrompt: string;
  let userPrompt: string;
  let responseFormat: 'text' | 'json_object' = 'text';

  if (mode === 'simple') {
    systemPrompt = getBaseSystemInstructions();
    userPrompt = buildSimplePrompt(code, language);
  } else if (mode === 'medium') {
    systemPrompt = getBaseSystemInstructions();
    userPrompt = buildMediumPrompt(code, language);
  } else {
    // advanced
    systemPrompt = 'You are an expert code auditor. Return only valid JSON.';
    userPrompt = buildAdvancedPrompt(code, language);
    responseFormat = 'json_object';
  }

  try {
    const content = await callOpenAIJson<string>(systemPrompt, userPrompt, {
      responseFormat,
    });

    // For simple/medium, content is plain text; wrap in a legacy response shape.
    if (mode !== 'advanced') {
      return {
        analysis: content,
        card_title: 'Code Analysis',
        key_concept: content.slice(0, 200),
        what_this_code_does: content,
        debug_analysis: '-',
        optimization: '-',
        linkedin_post: 'Check out this code analysis! #Zbloue',
      };
    }

    // Advanced mode should return JSON; we parse it and ensure it fits legacy shape.
    // Since the pipeline returns AdvancedAuditResult, we need to map it to Legacy.
    // For simplicity, we'll just return the parsed JSON (it should already be compatible).
    // But the legacy shape expects specific fields; we'll use a fallback.
    const parsed = typeof content === 'string' ? JSON.parse(content) : content;
    return {
      analysis: parsed.summary || '',
      card_title: parsed.title || 'Code Analysis',
      key_concept: parsed.summary?.slice(0, 200) || '',
      what_this_code_does: parsed.executionOverview?.entryPoints?.join(', ') || '',
      debug_analysis: parsed.findings?.length ? `${parsed.findings.length} findings` : '-',
      optimization: parsed.recommendedActions?.length
        ? parsed.recommendedActions.map((a: any) => a.title).join('; ')
        : '-',
      linkedin_post: parsed.linkedin_post || 'Check out this code analysis! #Zbloue',
      codeWalkthrough: [],
      whatWorksWell: [],
      bugsAndRiskyCases: [],
      edgeCases: [],
      recommendedImprovements: [],
      improvedCode: parsed.improvedCode?.available
        ? {
            available: parsed.improvedCode.available,
            code: parsed.improvedCode.code || '',
            notes: parsed.improvedCode.notes || '',
          }
        : undefined,
      suggestedTests: [],
      scorecard: undefined,
      finalVerdict: parsed.verdict
        ? {
            summary: parsed.verdict.explanation,
            approved: parsed.verdict.status === 'approved' || parsed.verdict.status === 'approved-with-suggestions',
            nextSteps: '',
          }
        : undefined,
      error: undefined,
    };
  } catch (error) {
    logger.error('[ai] Generation failed:', error);
    return {
      error: error instanceof Error ? error.message : 'AI generation failed',
      card_title: 'Error',
      analysis: 'Failed to generate analysis.',
      key_concept: '',
      what_this_code_does: '',
      debug_analysis: '',
      optimization: '',
      linkedin_post: '',
    };
  }
}