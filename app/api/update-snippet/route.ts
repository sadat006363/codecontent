import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await req.json();

    // ===== فیلدهای قابل به‌روزرسانی =====
    const {
      username,
      github_username,
      line_explanations,
      generated_prompt,
    } = body;

    const updateData: any = {};
    if (username !== undefined) updateData.username = username;
    if (github_username !== undefined) updateData.github_username = github_username;
    if (line_explanations !== undefined) updateData.line_explanations = line_explanations;
    if (generated_prompt !== undefined) updateData.generated_prompt = generated_prompt;

    // اگر هیچ فیلدی برای به‌روزرسانی وجود نداشته باشد
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('snippets')
      .update(updateData)
      .eq('slug', slug)
      .select()
      .single();

    if (error) {
      console.error('Supabase update error:', error);
      return NextResponse.json(
        { error: `Database error: ${error.message}` },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Snippet not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error: any) {
    console.error('Update error:', error);
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}