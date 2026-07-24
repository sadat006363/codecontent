// lib/ai.ts

import { callOpenAI, callOpenAIJson } from './openaiClient';
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
// 2. Helper: safe slice (to avoid "slice is not a function")
// ============================================================

function safeSlice(value: unknown, start: number, end?: number): string {
  if (typeof value === 'string') {
    return value.slice(start, end);
  }
  return '';
}

// ============================================================
// 3. Main generation function
// ============================================================

export async function generateEducationalContent(
  code: string,
  language: string,
  mode: 'simple' | 'medium' | 'advanced'
): Promise<LegacyGenerateResponse> {
  logger.info(`[ai] Generating ${mode} analysis for ${language}`);

  let systemPrompt: string;
  let userPrompt: string;

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
  }

  try {
    if (mode === 'simple' || mode === 'medium') {
      // 🔥 For simple/medium, call OpenAI with text response
      const content = await callOpenAI(systemPrompt, userPrompt, {
        responseFormat: 'text',
      });

      // Ensure content is a string
      const text = typeof content === 'string' ? content : String(content);

      return {
        analysis: text,
        card_title: 'Code Analysis',
        key_concept: safeSlice(text, 0, 200),
        what_this_code_does: text,
        debug_analysis: '-',
        optimization: '-',
        linkedin_post: 'Check out this code analysis! #Zbloue',
      };
    } else {
      // 🔥 For advanced, call OpenAI with JSON response
      const content = await callOpenAIJson<any>(systemPrompt, userPrompt, {
        responseFormat: 'json_object',
      });

      // content should be parsed object
      const parsed = typeof content === 'string' ? JSON.parse(content) : content;

      return {
        analysis: parsed.summary || '',
        card_title: parsed.title || 'Code Analysis',
        key_concept: safeSlice(parsed.summary, 0, 200),
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
    }
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