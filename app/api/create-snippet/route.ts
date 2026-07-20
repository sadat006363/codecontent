// app/api/create-snippet/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { type Database } from '@/types/supabase';
import logger from '@/lib/logger';

// ============================================================
// 1. ENV validation
// ============================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

let supabaseAdmin: ReturnType<typeof createClient<Database>> | null = null;

function getSupabaseAdmin() {
  if (!supabaseAdmin) {
    supabaseAdmin = createClient<Database>(supabaseUrl!, supabaseServiceKey!);
  }
  return supabaseAdmin;
}

// ============================================================
// 2. Zod schemas
// ============================================================

const CreateSnippetRequestSchema = z.object({
  code: z.string().min(1),
  language: z.string().min(1),
  card_title: z.string().optional(),
  key_concept: z.string().optional(),
  what_this_code_does: z.string().optional(),
  debug_analysis: z.string().optional(),
  optimization: z.string().optional(),
  linkedin_post: z.string().optional(),
  username: z.string().nullable().optional(),
  github_username: z.string().nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  // ... بقیه فیلدها (می‌توانید از فایل قبلی کپی کنید)
}).strict();

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
// 3. Slug generator
// ============================================================

const SLUG_LENGTH = 10;
const MAX_SLUG_RETRIES = 3;

function generateSlug(): string {
  return randomBytes(SLUG_LENGTH).toString('base64url').slice(0, SLUG_LENGTH);
}

async function generateUniqueSlug(
  supabase: ReturnType<typeof createClient<Database>>,
  retries = MAX_SLUG_RETRIES
): Promise<string> {
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
// 4. Mapper with correct Insert type
// ============================================================

type SnippetInsert = Database['public']['Tables']['snippets']['Insert'];

function mapToDatabaseRow(body: CreateSnippetRequest, slug: string): SnippetInsert {
  const now = new Date().toISOString();

  // ✅ row به‌صورت صریح با تایپ SnippetInsert
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
    // ... سایر فیلدها (از body با شرط undefined)
  };

  // اضافه کردن فیلدهای اختیاری (در صورت وجود)
  if (body.code_walkthrough !== undefined) row.code_walkthrough = body.code_walkthrough;
  if (body.what_works_well !== undefined) row.what_works_well = body.what_works_well;
  if (body.bugs_and_risky_cases !== undefined) row.bugs_and_risky_cases = body.bugs_and_risky_cases;
  // ... بقیه فیلدها

  return row;
}

// ============================================================
// 5. POST handler
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const validation = CreateSnippetRequestSchema.safeParse(rawBody);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return NextResponse.json(
        { error: `${firstError.path.join('.')}: ${firstError.message}` },
        { status: 400 }
      );
    }

    const body = validation.data;
    const supabase = getSupabaseAdmin();

    const slug = await generateUniqueSlug(supabase);
    const row = mapToDatabaseRow(body, slug);

    // ✅ اینجا دیگر خطای never[] نمی‌دهد چون row تایپ SnippetInsert دارد
    const { data, error } = await supabase
      .from('snippets')
      .insert(row)
      .select('id, slug, card_title, username, github_username, avatar_url')
      .single();

    if (error) {
      logger.error('[create-snippet] Supabase insert error:', error);
      return NextResponse.json({ error: 'Failed to save snippet' }, { status: 500 });
    }

    if (!data) {
      logger.error('[create-snippet] Insert succeeded but returned no data');
      return NextResponse.json({ error: 'Snippet not returned' }, { status: 500 });
    }

    const parsed = CreatedSnippetSchema.safeParse(data);
    if (!parsed.success) {
      logger.error('[create-snippet] Invalid inserted row:', parsed.error.flatten());
      return NextResponse.json({ error: 'Invalid database response' }, { status: 500 });
    }

    const created = parsed.data;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';

    return NextResponse.json({
      success: true,
      id: created.id,
      slug: created.slug,
      url: `${baseUrl}/snippet/${created.slug}`,
      username: created.username,
      github_username: created.github_username,
      avatar_url: created.avatar_url,
    }, { status: 201 });
  } catch (error) {
    logger.error('[create-snippet] Unhandled error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}