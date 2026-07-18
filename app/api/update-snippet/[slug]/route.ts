import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Snippet } from '@/types';
import {
  MAX_REQUESTS_PER_IP,
  TIME_WINDOW,
} from '@/lib/constants';

// ===== Rate Limiting =====
const requestLog = new Map<string, { count: number; firstRequest: number }>();

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

// ===== Check environment variables (runtime only) =====
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiSecretKey = process.env.API_SECRET_KEY;

// ===== در زمان build خطا نمیده، فقط لاگ می‌ده =====
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('⚠️ Missing Supabase environment variables');
  }
  if (!apiSecretKey) {
    console.error('⚠️ Missing API_SECRET_KEY environment variable');
  }
}

const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co',
  supabaseServiceKey || 'placeholder-key'
);

type UpdateSnippetData = Partial<Pick<
  Snippet,
  'username' | 'github_username' | 'line_explanations' | 'generated_prompt' | 'avatar_url'
>>;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // ===== 1. Rate Limiting =====
    const ip = getClientIP(req);
    const now = Date.now();
    const log = requestLog.get(ip);

    if (log) {
      if (now - log.firstRequest > TIME_WINDOW) {
        requestLog.set(ip, { count: 1, firstRequest: now });
      } else if (log.count >= MAX_REQUESTS_PER_IP) {
        return NextResponse.json(
          {
            error: `Too many requests. Maximum ${MAX_REQUESTS_PER_IP} requests per 24 hours.`,
          },
          { status: 429 }
        );
      } else {
        log.count += 1;
        requestLog.set(ip, log);
      }
    } else {
      requestLog.set(ip, { count: 1, firstRequest: now });
    }

    // ===== 2. Authentication =====
    const apiKey = req.headers.get('x-api-key');
    
    // ===== اگر کلید در محیط تعریف نشده باشه، درخواست رد میشه =====
    if (!apiSecretKey) {
      return NextResponse.json(
        { error: 'Server configuration error: API key not set' },
        { status: 500 }
      );
    }
    
    if (apiKey !== apiSecretKey) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid API key' },
        { status: 401 }
      );
    }

    // ===== 3. Get slug and body =====
    const { slug } = await params;
    const body = await req.json();

    // ===== 4. Build update data with proper typing =====
    const updateData: UpdateSnippetData = {};

    if (body.username !== undefined) {
      updateData.username = body.username?.trim().slice(0, 50) || null;
    }
    if (body.github_username !== undefined) {
      updateData.github_username = body.github_username?.trim().slice(0, 50) || null;
    }
    if (body.line_explanations !== undefined) {
      updateData.line_explanations = body.line_explanations || null;
    }
    if (body.generated_prompt !== undefined) {
      updateData.generated_prompt = body.generated_prompt || null;
    }
    // ===== NEW: Support avatar_url update =====
    if (body.avatar_url !== undefined) {
      updateData.avatar_url = body.avatar_url || null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // ===== 5. Update database =====
    const { data, error } = await supabaseAdmin
      .from('snippets')
      .update(updateData)
      .eq('slug', slug)
      .select()
      .single();

    if (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Supabase update error:', error);
      }
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
    if (process.env.NODE_ENV === 'development') {
      console.error('Update error:', error);
    }
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}