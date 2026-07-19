// ============================================================
// 📁 فایل: app/snippet/[slug]/page.tsx
// ============================================================

import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Snippet } from '@/types';
import { renderJsonValue } from '@/lib/utils';
import SnippetHeader from '@/components/snippet/SnippetHeader';
import SnippetCode from '@/components/snippet/SnippetCode';
import SnippetAnalysis from '@/components/snippet/SnippetAnalysis';
import SnippetFullAnalysis from '@/components/snippet/SnippetFullAnalysis';
import SnippetDebug from '@/components/snippet/SnippetDebug';
import SnippetLinkedIn from '@/components/snippet/SnippetLinkedIn';
import SnippetTabLinks from '@/components/snippet/SnippetTabLinks';
import SnippetShareButtons from '@/components/snippet/SnippetShareButtons';
import SnippetFooter from '@/components/snippet/SnippetFooter';
import SnippetUserInfo from '@/components/snippet/SnippetUserInfo';

// ============================================================
// 🔥 اصلاح: params باید از نوع Promise باشد (Next.js 16)
// ============================================================
interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getSnippet(slug: string): Promise<Snippet | null> {
  const { data, error } = await supabase
    .from('snippets')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    return null;
  }

  return data as Snippet;
}

// ============================================================
// 🔥 تابع کمکی برای هایلایت کد (سمت سرور)
// ============================================================
async function highlightCode(code: string, language: string): Promise<string> {
  try {
    const { codeToHtml } = await import('shiki');
    return await codeToHtml(code, {
      lang: language,
      theme: 'github-dark',
    });
  } catch {
    return `<pre class="text-[#cdd6f4]">${code}</pre>`;
  }
}

export default async function SnippetPage({ params }: PageProps) {
  // ============================================================
  // 🔥 اصلاح: unwrap کردن params با await
  // ============================================================
  const { slug } = await params;
  const snippet = await getSnippet(slug);

  if (!snippet) {
    notFound();
  }

  // ساخت لینک اشتراک‌گذاری
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  const shareUrl = `${baseUrl}/snippet/${snippet.slug}`;

  // هایلایت کد
  const highlightedHtml = await highlightCode(snippet.raw_code, snippet.language);

  return (
    <main className="min-h-screen bg-[#f8f9fa]">
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-8">
        {/* Header */}
        <SnippetHeader shareUrl={shareUrl} />

        {/* User Info */}
        <SnippetUserInfo
          username={snippet.username || 'Anonymous'}
          githubUsername={snippet.github_username || undefined}
        />

        {/* Share Buttons */}
        <SnippetShareButtons slug={snippet.slug} title={snippet.card_title} />

        {/* Tab Links */}
        <SnippetTabLinks shareUrl={shareUrl} />

        {/* Code Section */}
        <SnippetCode
          code={snippet.raw_code}
          language={snippet.language}
          highlightedHtml={highlightedHtml}
        />

        {/* Key Concept & What It Does */}
        <SnippetAnalysis
          keyConcept={snippet.key_concept}
          whatItDoes={snippet.what_this_code_does}
        />

        {/* Debug & Optimization */}
        <SnippetDebug
          debugAnalysis={snippet.debug_analysis}
          optimization={snippet.optimization}
        />

        {/* Full Analysis */}
        <SnippetFullAnalysis snippet={snippet} renderJsonValue={renderJsonValue} />

        {/* LinkedIn Post */}
        {snippet.linkedin_post && (
          <SnippetLinkedIn linkedinPost={snippet.linkedin_post} />
        )}

        {/* Footer */}
        <SnippetFooter appUrl={baseUrl || 'https://zbloue.vercel.app'} />
      </div>
    </main>
  );
}