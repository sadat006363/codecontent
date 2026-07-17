import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import CardPreview from '@/components/card/CardPreview';
import { CardTheme } from '@/components/card/themes';
import { Metadata } from 'next';

// ============================================================
// 🔥 جلوگیری از Static Generation در زمان build
// ============================================================
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ============================================================
// 🔥 Supabase Client با fallback (برای build بدون خطا)
// ============================================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// ============================================================
// 🔥 Interface برای Props
// ============================================================
interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ theme?: CardTheme }>;
}

// ============================================================
// 🔥 متادیتا (با fallback برای خطا)
// ============================================================
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { data: snippet } = await supabaseAdmin
      .from('snippets')
      .select('card_title')
      .eq('slug', slug)
      .single();

    return {
      title: snippet?.card_title ? `${snippet.card_title} | Zbloue` : 'Code Snippet | Zbloue',
    };
  } catch {
    return { title: 'Code Snippet | Zbloue' };
  }
}

// ============================================================
// 🔥 صفحه اصلی کارت (با استفاده از CardPreview)
// ============================================================
export default async function CardPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const theme = (await searchParams)?.theme || 'blue';

  try {
    // ===== 1. دریافت داده از Supabase =====
    const { data: snippet, error } = await supabaseAdmin
      .from('snippets')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !snippet) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Card fetch error:', error);
      }
      notFound();
    }

    // ============================================================
    // 🔥 رندر کارت با کامپوننت CardPreview
    // ============================================================
    return (
      <div className="min-h-screen bg-[#0f0f14] flex items-center justify-center p-4">
        <div className="w-full max-w-[1200px]">
          <CardPreview
            title={snippet.card_title || 'Code Analysis'}
            summary={snippet.key_concept || 'Analysis of the provided code snippet.'}
            username={snippet.username || 'Developer'}
            slug={snippet.slug}
            language={snippet.language}
            theme={theme}
            showCode={true}
            codeSnippet={snippet.raw_code}
            createdAt={snippet.created_at}
            githubUsername={snippet.github_username || undefined}
          />
        </div>
      </div>
    );
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error loading card:', error);
    }
    notFound();
  }
}