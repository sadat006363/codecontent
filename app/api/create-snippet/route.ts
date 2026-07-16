import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { 
  MAX_LINES_GENERATE, 
  MAX_CODE_LENGTH, 
  MAX_PAYLOAD_SIZE,
  SUPPORTED_LANGUAGES 
} from '@/lib/constants';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  return '127.0.0.1';
}

export async function POST(req: NextRequest) {
  try {
    // ===== 1. Rate Limiting =====
    const ip = getClientIP(req);

    // ===== 2. Payload size limit =====
    const rawBody = await req.text();
    if (rawBody.length > MAX_PAYLOAD_SIZE) {
      return NextResponse.json(
        { error: `Payload too large (max ${MAX_PAYLOAD_SIZE/1000}KB)` },
        { status: 413 }
      );
    }

    const body = JSON.parse(rawBody);
    const {
      code,
      language,
      card_title,
      key_concept,
      what_this_code_does,
      debug_analysis,
      optimization,
      linkedin_post,
      username,
      github_username,
      // ===== فیلدهای جدید =====
      code_walkthrough,
      what_works_well,
      bugs_and_risky_cases,
      edge_cases,
      performance_analysis,
      security_analysis,
      production_readiness,
      recommended_improvements,
      improved_code,
      suggested_tests,
      scorecard,
      final_verdict_summary,
      final_verdict_approved,
      final_verdict_next_steps,
      line_explanations,
      generated_prompt,
    } = body;

    // ===== 3. Validate required fields =====
    if (!code || !code.trim()) {
      return NextResponse.json(
        { error: 'Code is required' },
        { status: 400 }
      );
    }

    if (!language) {
      return NextResponse.json(
        { error: 'Language is required' },
        { status: 400 }
      );
    }

    if (!card_title || !key_concept || !what_this_code_does || 
        !debug_analysis || !optimization || !linkedin_post) {
      return NextResponse.json(
        { error: 'All AI-generated fields are required' },
        { status: 400 }
      );
    }

    // ===== 4. Code limits =====
    const lines = code.split('\n').length;
    if (lines > MAX_LINES_GENERATE) {
      return NextResponse.json(
        { error: `Code exceeds ${MAX_LINES_GENERATE} lines (${lines} lines)` },
        { status: 400 }
      );
    }

    if (code.length > MAX_CODE_LENGTH) {
      return NextResponse.json(
        { error: `Code is too long (${code.length} characters)` },
        { status: 400 }
      );
    }

    // ===== 5. Supported languages =====
    if (!SUPPORTED_LANGUAGES.includes(language as any)) {
      return NextResponse.json(
        { error: `Unsupported language: ${language}` },
        { status: 400 }
      );
    }

    // ===== 6. Sanitize inputs (security) =====
    const sanitizedCode = code.replace(/[<>]/g, '');
    const slug = nanoid(10);

    const sanitizedUsername = username ? username.trim().slice(0, 50) : null;
    const sanitizedGithubUsername = github_username ? github_username.trim().slice(0, 50) : null;

    // ===== 7. Build payload with new fields =====
    const payload = {
      slug,
      raw_code: sanitizedCode,
      language,
      card_title: card_title.slice(0, 500),
      key_concept: key_concept.slice(0, 2000),
      what_this_code_does: what_this_code_does.slice(0, 5000),
      debug_analysis: debug_analysis.slice(0, 5000),
      optimization: optimization.slice(0, 5000),
      linkedin_post: linkedin_post.slice(0, 1000),
      username: sanitizedUsername,
      github_username: sanitizedGithubUsername,
      is_public: true,
      user_id: null,
      // ===== فیلدهای جدید =====
      code_walkthrough: code_walkthrough || null,
      what_works_well: what_works_well || null,
      bugs_and_risky_cases: bugs_and_risky_cases || null,
      edge_cases: edge_cases || null,
      performance_analysis: performance_analysis || null,
      security_analysis: security_analysis || null,
      production_readiness: production_readiness || null,
      recommended_improvements: recommended_improvements || null,
      improved_code: improved_code || null,
      suggested_tests: suggested_tests || null,
      scorecard: scorecard || null,
      final_verdict_summary: final_verdict_summary || null,
      final_verdict_approved: final_verdict_approved || null,
      final_verdict_next_steps: final_verdict_next_steps || null,
      line_explanations: line_explanations || null,
      generated_prompt: generated_prompt || null,
    };

    // ===== 8. Save to database =====
    const { data, error } = await supabaseAdmin
      .from('snippets')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      id: data.id,
      slug: data.slug,
      card_title: data.card_title,
      key_concept: data.key_concept,
      what_this_code_does: data.what_this_code_does,
      debug_analysis: data.debug_analysis,
      optimization: data.optimization,
      linkedin_post: data.linkedin_post,
      username: data.username,
      github_username: data.github_username,
      // ===== فیلدهای جدید در پاسخ =====
      code_walkthrough: data.code_walkthrough,
      what_works_well: data.what_works_well,
      bugs_and_risky_cases: data.bugs_and_risky_cases,
      edge_cases: data.edge_cases,
      performance_analysis: data.performance_analysis,
      security_analysis: data.security_analysis,
      production_readiness: data.production_readiness,
      recommended_improvements: data.recommended_improvements,
      improved_code: data.improved_code,
      suggested_tests: data.suggested_tests,
      scorecard: data.scorecard,
      final_verdict_summary: data.final_verdict_summary,
      final_verdict_approved: data.final_verdict_approved,
      final_verdict_next_steps: data.final_verdict_next_steps,
      line_explanations: data.line_explanations,
      generated_prompt: data.generated_prompt,
      url: `/snippet/${data.slug}`,
    });

  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error occurred' },
      { status: 500 }
    );
  }
}