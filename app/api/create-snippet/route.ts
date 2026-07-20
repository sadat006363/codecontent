// app/api/create-snippet/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { type AdvancedAuditResult } from '@/lib/analysis/schema';
import logger from '@/lib/logger';

// ============================================================
// 1. ENV validation (fail-fast)
// ============================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

let supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(supabaseUrl!, supabaseServiceKey!);
  }
  return supabaseAdmin;
}

// ============================================================
// 2. Zod validation schema (runtime enforcement)
// ============================================================

const CreateSnippetRequestSchema = z
  .object({
    // Core required fields
    code: z.string().min(1, 'Code is required').max(100_000, 'Code is too large (max 100KB)'),
    language: z.string().min(1, 'Language is required').max(50, 'Language name too long'),

    // Basic metadata (optional)
    card_title: z.string().min(1).max(200).optional(),
    key_concept: z.string().max(2000).optional(),
    what_this_code_does: z.string().max(10000).optional(),
    debug_analysis: z.string().max(5000).optional(),
    optimization: z.string().max(5000).optional(),
    linkedin_post: z.string().max(300).optional(),
    username: z.string().min(1).max(100).nullable().optional(),
    github_username: z.string().min(1).max(100).nullable().optional(),
    avatar_url: z.string().url().nullable().optional(),

    // Legacy advanced fields (optional, any JSON)
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

    // NEW canonical advanced fields (from AdvancedAuditResult)
    findings: z.any().optional().nullable(),
    execution_overview: z.any().optional().nullable(),
    architectural_observations: z.any().optional().nullable(),
    recommended_actions: z.any().optional().nullable(),
    suggested_tests_new: z.any().optional().nullable(),
    complexity: z.any().optional().nullable(),
    scorecard_new: z.any().optional().nullable(),
    verdict: z.any().optional().nullable(),
    limitations: z.array(z.string().max(300)).max(20).optional().nullable(),
  })
  .strict(); // Reject unknown fields

export type CreateSnippetRequest = z.infer<typeof CreateSnippetRequestSchema>;

// ============================================================
// 3. Slug generator (collision-safe with retry)
// ============================================================

const SLUG_LENGTH = 10;
const MAX_SLUG_RETRIES = 3;

function generateSlug(): string {
  return randomBytes(SLUG_LENGTH)
    .toString('base64url')
    .slice(0, SLUG_LENGTH);
}

async function generateUniqueSlug(
  supabase: ReturnType<typeof createClient>,
  retries = MAX_SLUG_RETRIES
): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const slug = generateSlug();
    // Check if slug already exists
    const { data, error } = await supabase
      .from('snippets')
      .select('slug')
      .eq('slug', slug)
      .maybeSingle();

    if (error) {
      // If error is not "not found", propagate it
      logger.error('[create-snippet] Slug uniqueness check error:', error);
      throw new Error('Failed to check slug uniqueness');
    }

    if (!data) {
      return slug; // Slug is free
    }
    // Otherwise, loop and generate a new one
    logger.warn(`[create-snippet] Slug collision: ${slug}, retrying...`);
  }

  throw new Error('Failed to generate unique slug after multiple retries');
}

// ============================================================
// 4. Database mapper (explicit, type-safe)
// ============================================================

interface DatabaseRow {
  slug: string;
  raw_code: string;
  language: string;
  card_title: string;
  key_concept: string;
  what_this_code_does: string;
  debug_analysis: string;
  optimization: string;
  linkedin_post: string;
  username: string | null;
  github_username: string | null;
  avatar_url: string | null;
  is_public: boolean;
  created_at?: string;

  // Legacy
  code_walkthrough?: any | null;
  what_works_well?: any | null;
  bugs_and_risky_cases?: any | null;
  edge_cases?: any | null;
  performance_analysis?: any | null;
  security_analysis?: any | null;
  production_readiness?: any | null;
  recommended_improvements?: any | null;
  improved_code?: string | null;
  suggested_tests?: any | null;
  scorecard?: any | null;
  final_verdict_summary?: string | null;
  final_verdict_approved?: boolean | null;
  final_verdict_next_steps?: string | null;

  // NEW
  findings?: any | null;
  execution_overview?: any | null;
  architectural_observations?: any | null;
  recommended_actions?: any | null;
  suggested_tests_new?: any | null;
  complexity?: any | null;
  scorecard_new?: any | null;
  verdict?: any | null;
  limitations?: string[] | null;
}

function mapToDatabaseRow(
  body: CreateSnippetRequest,
  slug: string
): DatabaseRow {
  const now = new Date().toISOString();

  // Normalize optional user fields
  const username = body.username || null;
  const githubUsername = body.github_username || null;
  const avatarUrl = body.avatar_url || null;

  const row: DatabaseRow = {
    slug,
    raw_code: body.code,
    language: body.language,
    card_title: body.card_title || 'Code Analysis',
    key_concept: body.key_concept || '',
    what_this_code_does: body.what_this_code_does || '',
    debug_analysis: body.debug_analysis || '-',
    optimization: body.optimization || '-',
    linkedin_post: body.linkedin_post || '',
    username,
    github_username: githubUsername,
    avatar_url: avatarUrl,
    is_public: true,
    created_at: now, // Explicitly set for consistency; DB could default, but we set it to be explicit
  };

  // Legacy optional fields
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

  // NEW canonical advanced fields
  if (body.findings !== undefined) row.findings = body.findings;
  if (body.execution_overview !== undefined) row.execution_overview = body.execution_overview;
  if (body.architectural_observations !== undefined) row.architectural_observations = body.architectural_observations;
  if (body.recommended_actions !== undefined) row.recommended_actions = body.recommended_actions;
  if (body.suggested_tests_new !== undefined) row.suggested_tests_new = body.suggested_tests_new;
  if (body.complexity !== undefined) row.complexity = body.complexity;
  if (body.scorecard_new !== undefined) row.scorecard_new = body.scorecard_new;
  if (body.verdict !== undefined) row.verdict = body.verdict;
  if (body.limitations !== undefined) row.limitations = body.limitations;

  return row;
}

// ============================================================
// 5. Main handler
// ============================================================

export async function POST(req: NextRequest) {
  try {
    // --- Parse raw body ---
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    // --- Validate with Zod ---
    const validation = CreateSnippetRequestSchema.safeParse(rawBody);
    if (!validation.success) {
      logger.warn('[create-snippet] Validation failed:', validation.error.issues);
      // Return first error message for simplicity
      const firstError = validation.error.issues[0];
      return NextResponse.json(
        { error: `Validation error: ${firstError.path.join('.')} - ${firstError.message}` },
        { status: 400 }
      );
    }

    const body = validation.data;

    // --- Get Supabase client ---
    const supabase = getSupabaseAdmin();

    // --- Generate unique slug ---
    let slug: string;
    try {
      slug = await generateUniqueSlug(supabase);
    } catch (error) {
      logger.error('[create-snippet] Slug generation failed:', error);
      return NextResponse.json(
        { error: 'Failed to generate unique identifier' },
        { status: 500 }
      );
    }

    // --- Map to database row ---
    const row = mapToDatabaseRow(body, slug);

    // --- Insert into Supabase ---
    const { data, error } = await supabase
      .from('snippets')
      .insert(row)
      .select('id, slug, card_title, username, github_username, avatar_url')
      .single();

    if (error) {
      logger.error('[create-snippet] Supabase insert error:', error);
      return NextResponse.json(
        { error: 'Failed to save snippet' },
        { status: 500 }
      );
    }

    // --- Build response (minimal) ---
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const response = {
      success: true,
      id: data.id,
      slug: data.slug,
      url: `${baseUrl}/snippet/${data.slug}`,
      username: data.username,
      github_username: data.github_username,
      avatar_url: data.avatar_url,
    };

    logger.info(`[create-snippet] Snippet created: ${data.slug}`);
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logger.error('[create-snippet] Unhandled error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}