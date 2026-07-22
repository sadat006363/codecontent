// app/api/convert-code/route.ts

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { rateLimiter, getClientIP } from '@/lib/rateLimiter';
import logger from '@/lib/logger';
import { withErrorHandlerAndLog } from '@/lib/errorHandler';

const openaiApiKey = process.env.OPENAI_API_KEY || 'placeholder-key';
const openai = new OpenAI({ apiKey: openaiApiKey });

const SUPPORTED_LANGUAGES = [
  'javascript', 'typescript', 'python', 'java',
  'rust', 'go', 'cpp', 'php'
];

const NON_CONVERTIBLE = ['html', 'css', 'json'];

const CONVERSION_MAP: Record<string, string[]> = {
  'javascript': ['typescript', 'python', 'java', 'go', 'php', 'cpp'],
  'typescript': ['javascript', 'python', 'java', 'go', 'php', 'cpp'],
  'python': ['javascript', 'java', 'go', 'cpp', 'php'],
  'java': ['javascript', 'python', 'go', 'cpp', 'php'],
  'rust': ['javascript', 'python', 'go'],
  'go': ['javascript', 'python', 'java', 'cpp', 'php'],
  'cpp': ['javascript', 'python', 'java', 'go', 'php'],
  'php': ['javascript', 'python', 'java', 'go'],
};

export const POST = withErrorHandlerAndLog(async (req: NextRequest) => {
  const ip = getClientIP(req);

  // ===== Rate Limiter =====
  const rateLimitResult = await rateLimiter(ip);
  if (!rateLimitResult.allowed) {
    logger.warn(`[convert-code] Rate limit exceeded for IP ${ip}`);
    return NextResponse.json(
      { error: rateLimitResult.message },
      { status: 429 }
    );
  }

  const { code, sourceLanguage, targetLanguage } = await req.json();

  if (!code || !sourceLanguage || !targetLanguage) {
    return NextResponse.json(
      { error: 'Code, source language, and target language are required' },
      { status: 400 }
    );
  }

  if (NON_CONVERTIBLE.includes(sourceLanguage)) {
    return NextResponse.json(
      {
        error: `${sourceLanguage.toUpperCase()} is a markup/data language and cannot be converted to other languages.`,
        availableTargets: [],
      },
      { status: 400 }
    );
  }

  if (!SUPPORTED_LANGUAGES.includes(sourceLanguage)) {
    return NextResponse.json(
      { error: `Source language "${sourceLanguage}" is not supported for conversion` },
      { status: 400 }
    );
  }

  if (!SUPPORTED_LANGUAGES.includes(targetLanguage)) {
    return NextResponse.json(
      { error: `Target language "${targetLanguage}" is not supported for conversion` },
      { status: 400 }
    );
  }

  const availableTargets = CONVERSION_MAP[sourceLanguage] || [];
  if (!availableTargets.includes(targetLanguage)) {
    return NextResponse.json(
      {
        error: `Conversion from ${sourceLanguage} to ${targetLanguage} is not supported.`,
        availableTargets,
      },
      { status: 400 }
    );
  }

  if (code.length > 30000) {
    return NextResponse.json(
      { error: 'Code is too long for conversion. Maximum 30,000 characters.' },
      { status: 400 }
    );
  }

  const prompt = `
You are an expert software engineer. Convert the following code from ${sourceLanguage} to ${targetLanguage}.

Rules:
1. Keep the same logic and functionality.
2. Use the best practices and idiomatic syntax of the target language.
3. Preserve comments and variable names where possible.
4. If the code uses a framework or library that doesn't exist in the target language, suggest an alternative.
5. Return ONLY the converted code, no explanations.

Source code (${sourceLanguage}):
\`\`\`
${code}
\`\`\`

Converted code (${targetLanguage}):
`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const response = await openai.chat.completions.create(
    {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a code conversion expert. Return only the converted code. Do not add any explanations or markdown formatting.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_completion_tokens: 4000,
    },
    { signal: controller.signal }
  );

  clearTimeout(timeoutId);

  const convertedCode = response.choices[0].message.content || '';

  const cleanCode = convertedCode
    .replace(/^```[a-zA-Z]*\s*/, '')
    .replace(/\s*```$/, '')
    .trim();

  logger.info(`[convert-code] Conversion successful: ${sourceLanguage} → ${targetLanguage} (IP ${ip})`);
  return NextResponse.json({
    success: true,
    sourceLanguage,
    targetLanguage,
    convertedCode: cleanCode,
  });
});