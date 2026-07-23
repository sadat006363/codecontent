// app/api/create-snippet/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { supabase } from '@/lib/supabase';
import logger from '@/lib/logger';
import { rateLimiter, getClientIP } from '@/lib/rateLimiter';
import { withErrorHandlerAndLog } from '@/lib/errorHandler';

// ============================================================
// 1. Zod schemas (بدون debug_trace)
// ============================================================

const CreateSnippetRequestSchema = z
  .object({
    code: z.string().min(1).max(100000),
    language: z.string().min(1).max(50),
    card_title: z.string().min(1).max(200).optional(),
    key_concept: z.string().max(2000).optional(),
    what_this_code_does: z.string().max(10000).optional(),
    debug_analysis: z.string().max(5000).optional(),
    optimization: z.string().max(5000).optional(),
    linkedin_post: z.string().max(300).optional(),
    username: z.string().min(1).max(100).nullable().optional(),
    github_username: z.string().min(1).max(100).nullable().optional(),
    avatar_url: z.string().url().nullable().optional(),
    code_walkthrough: z.any().optional().nullable(),
    what_works_well: z.any().optional().nullable(),
    bugs_and_risky_cases: z.any().optional().nullable(),
    edge_cases: z.any().optional().nullable(),
    performance_analysis: z.any().optional().nullable(),
    security_analysis: z.any().optional().nullable(),
    production_readiness: z.any().optional().nullable(),
    recommended_improvements: z.any().optional().nullable(),
    improved_code: z.string().optional().nullable(),
    suggested_tests: z.any().optional().nullable(),
    scorecard: z.any().optional().nullable(),
    final_verdict_summary: z.string().optional().nullable(),
    final_verdict_approved: z.boolean().optional().nullable(),
    final_verdict_next_steps: z.string().optional().nullable(),
    findings: z.any().optional().nullable(),
    execution_overview: z.any().optional().nullable(),
    architectural_observations: z.any().optional().nullable(),
    recommended_actions: z.any().optional().nullable(),
    suggested_tests_new: z.any().optional().nullable(),
    complexity: z.any().optional().nullable(),
    scorecard_new: z.any().optional().nullable(),
    verdict: z.any().optional().nullable(),
    limitations: z.array(z.string().max(300)).max(20).optional().nullable(),
    // ❌ debug_trace: z.any().nullable().optional(), // حذف شده
  })
  .strict();

type CreateSnippetRequest = z.infer<typeof CreateSnippetRequestSchema>;

const CreatedSnippetSchema = z.object({
  id: z.string(),
  slug: z.string(),
  card_title: z.string(),
  username: z.string().nullable().optional(),
  github_username: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
});

// ============================================================
// 2. Slug generator
// ============================================================

const SLUG_LENGTH = 10;
const MAX_SLUG_RETRIES = 3;

function generateSlug(): string {
  return randomBytes(SLUG_LENGTH)
    .toString('base64url')
    .slice(0, SLUG_LENGTH);
}

async function generateUniqueSlug(retries = MAX_SLUG_RETRIES): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const slug = generateSlug();
    const { data, error } = await supabase
      .from('snippets')
      .select('slug')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      logger.error('[create-snippet] Slug uniqueness check error:', error);
      throw new Error('Failed to check slug uniqueness');
    }
    if (!data) return slug;
    logger.warn(`[create-snippet] Slug collision: ${slug}, retrying...`);
  }
  throw new Error('Failed to generate unique slug after multiple retries');
}

// ============================================================
// 3. Database mapper (بدون debug_trace)
// ============================================================

type SnippetInsert = any;

function mapToDatabaseRow(body: CreateSnippetRequest, slug: string): SnippetInsert {
  const now = new Date().toISOString();

  const row: SnippetInsert = {
    slug,
    raw_code: body.code,
    language: body.language,
    card_title: body.card_title ?? 'Code Analysis',
    key_concept: body.key_concept ?? '',
    what_this_code_does: body.what_this_code_does ?? '',
    debug_analysis: body.debug_analysis ?? '-',
    optimization: body.optimization ?? '-',
    linkedin_post: body.linkedin_post ?? '',
    username: body.username ?? null,
    github_username: body.github_username ?? null,
    avatar_url: body.avatar_url ?? null,
    is_public: true,
    created_at: now,
  };

  // Legacy fields
  if (body.code_walkthrough !== undefined) row.code_walkthrough = body.code_walkthrough;
  if (body.what_works_well !== undefined) row.what_works_well = body.what_works_well;
  if (body.bugs_and_risky_cases !== undefined) row.bugs_and_risky_cases = body.bugs_and_risky_cases;
  if (body.edge_cases !== undefined) row.edge_cases = body.edge_cases;
  if (body.performance_analysis !== undefined) row.performance_analysis = body.performance_analysis;
  if (body.security_analysis !== undefined) row.security_analysis = body.security_analysis;
  if (body.production_readiness !== undefined) row.production_readiness = body.production_readiness;
  if (body.recommended_improvements !== undefined) row.recommended_improvements = body.recommended_improvements;
  if (body.improved_code !== undefined) row.improved_code = body.improved_code;
  if (body.suggested_tests !== undefined) row.suggested_tests = body.suggested_tests;
  if (body.scorecard !== undefined) row.scorecard = body.scorecard;
  if (body.final_verdict_summary !== undefined) row.final_verdict_summary = body.final_verdict_summary;
  if (body.final_verdict_approved !== undefined) row.final_verdict_approved = body.final_verdict_approved;
  if (body.final_verdict_next_steps !== undefined) row.final_verdict_next_steps = body.final_verdict_next_steps;

  // New fields
  if (body.findings !== undefined) row.findings = body.findings;
  if (body.execution_overview !== undefined) row.execution_overview = body.execution_overview;
  if (body.architectural_observations !== undefined) row.architectural_observations = body.architectural_observations;
  if (body.recommended_actions !== undefined) row.recommended_actions = body.recommended_actions;
  if (body.suggested_tests_new !== undefined) row.suggested_tests_new = body.suggested_tests_new;
  if (body.complexity !== undefined) row.complexity = body.complexity;
  if (body.scorecard_new !== undefined) row.scorecard_new = body.scorecard_new;
  if (body.verdict !== undefined) row.verdict = body.verdict;
  if (body.limitations !== undefined) row.limitations = body.limitations;

  // ❌ debug_trace حذف شده
  // if (body.debug_trace !== undefined) row.debug_trace = body.debug_trace;

  return row;
}

// ============================================================
// 4. POST Handler
// ============================================================

export const POST = withErrorHandlerAndLog(async (req: NextRequest) => {
  const ip = getClientIP(req);

  const rateLimitResult = await rateLimiter(ip);
  if (!rateLimitResult.allowed) {
    logger.warn(`[create-snippet] Rate limit exceeded for IP ${ip}`);
    return NextResponse.json(
      { error: rateLimitResult.message },
      { status: 429 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const validation = CreateSnippetRequestSchema.safeParse(rawBody);
  if (!validation.success) {
    logger.warn('[create-snippet] Validation failed:', validation.error.issues);
    const firstError = validation.error.issues[0];
    return NextResponse.json(
      { error: `Validation error: ${firstError.path.join('.')} - ${firstError.message}` },
      { status: 400 }
    );
  }

  const body = validation.data;

  let slug: string;
  try {
    slug = await generateUniqueSlug();
  } catch (error) {
    logger.error('[create-snippet] Slug generation failed:', error);
    return NextResponse.json({ error: 'Failed to generate unique identifier' }, { status: 500 });
  }

  const row = mapToDatabaseRow(body, slug);

  const { data, error } = await supabase
    .from('snippets')
    .insert(row as any)
    .select('id, slug, card_title, username, github_username, avatar_url')
    .single();

  if (error) {
    logger.error('[create-snippet] Supabase insert error:', error);
    return NextResponse.json({ error: 'Failed to save snippet' }, { status: 500 });
  }

  if (!data) {
    logger.error('[create-snippet] Insert succeeded but returned no data');
    return NextResponse.json({ error: 'Snippet was not returned after creation' }, { status: 500 });
  }

  const parsed = CreatedSnippetSchema.safeParse(data);
  if (!parsed.success) {
    logger.error('[create-snippet] Invalid inserted row:', parsed.error.flatten());
    return NextResponse.json({ error: 'Invalid database response' }, { status: 500 });
  }

  const created = parsed.data;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';

  logger.info(`[create-snippet] Snippet created: ${created.slug} (IP ${ip})`);
  return NextResponse.json(
    {
      success: true,
      id: created.id,
      slug: created.slug,
      url: `${baseUrl}/snippet/${created.slug}`,
      username: created.username ?? null,
      github_username: created.github_username ?? null,
      avatar_url: created.avatar_url ?? null,
    },
    { status: 201 }
  );
});