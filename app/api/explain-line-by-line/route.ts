// app/api/explain-line-by-line/route.ts

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { MAX_LINES_EXPLAIN, MAX_CODE_LENGTH } from '@/lib/constants';
import { removeComments } from '@/lib/utils';
import { rateLimiter, getClientIP } from '@/lib/rateLimiter';
import logger from '@/lib/logger';
import { withErrorHandlerAndLog } from '@/lib/errorHandler';

const openaiApiKey = process.env.OPENAI_API_KEY || 'placeholder-key';
const openai = new OpenAI({ apiKey: openaiApiKey });

export const POST = withErrorHandlerAndLog(async (req: NextRequest) => {
  const ip = getClientIP(req);

  // ===== Rate Limiter =====
  const rateLimitResult = await rateLimiter(ip);
  if (!rateLimitResult.allowed) {
    logger.warn(`[explain-line-by-line] Rate limit exceeded for IP ${ip}`);
    return NextResponse.json(
      { error: rateLimitResult.message },
      { status: 429 }
    );
  }

  const { code, language } = await req.json();

  if (!code || !language) {
    return NextResponse.json(
      { error: 'Code and language are required' },
      { status: 400 }
    );
  }

  const codeWithoutComments = removeComments(code, language);

  const lines = codeWithoutComments.split('\n').filter((line: string) => line.trim().length > 0);
  if (lines.length > MAX_LINES_EXPLAIN) {
    return NextResponse.json(
      { error: `Code exceeds ${MAX_LINES_EXPLAIN} lines (${lines.length} lines). Please shorten your code.` },
      { status: 400 }
    );
  }

  if (codeWithoutComments.length > MAX_CODE_LENGTH) {
    return NextResponse.json(
      { error: `Code is too long (${codeWithoutComments.length} characters).` },
      { status: 400 }
    );
  }

  const systemPrompt = `
You are an expert programming tutor. Explain the provided code line by line.

**IMPORTANT RULES:**
1. Provide a concise explanation for each line (max 1-2 sentences per line).
2. Focus on WHAT the line does and WHY it's important.
3. Use simple, easy-to-understand language.
4. For long code, prioritize important lines and group similar ones.
5. Output MUST be in valid JSON format.

**Output Format:**
{
  "explanations": [
    {
      "lineNumber": 1,
      "code": "const x = 5;",
      "explanation": "Declares a constant variable x and assigns it the value 5."
    }
  ]
}
`;

  const userPrompt = `
Explain the following ${language} code line by line:

\`\`\`${language}
${codeWithoutComments}
\`\`\`

Provide a clear explanation for each line of code.
`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);

  const response = await openai.chat.completions.create(
    {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
      max_completion_tokens: 12000,
    },
    { signal: controller.signal }
  );

  clearTimeout(timeoutId);

  const content = response.choices[0].message.content || '{}';

  let data;
  try {
    data = JSON.parse(content);
  } catch (parseError) {
    if (process.env.NODE_ENV === 'development') {
      console.error('JSON Parse Error:', parseError);
      console.error('Raw content:', content);
    }
    return NextResponse.json(
      { error: 'AI response format error. Please try again with shorter code.' },
      { status: 500 }
    );
  }

  logger.info(`[explain-line-by-line] Success for IP ${ip}, ${data.explanations?.length || 0} explanations`);
  return NextResponse.json({
    explanations: data.explanations || [],
  });
});