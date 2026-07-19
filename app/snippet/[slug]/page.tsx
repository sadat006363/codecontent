// ============================================================
// 📁 فایل: app/snippet/[slug]/page.tsx (نسخه نهایی null-safe)
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

// ============================================================
// 🔥 تابع دریافت اسنیپت با null-safe
// ============================================================
async function getSnippet(slug: string): Promise<Snippet | null> {
  const { data, error } = await supabase
    .from('snippets')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    return null;
  }

  // ===== تبدیل داده‌ها با مقداردهی پیش‌فرض null-safe =====
  const snippet: Snippet = {
    id: data.id ?? '',
    slug: data.slug ?? '',
    raw_code: data.raw_code ?? '',
    language: data.language ?? 'javascript',
    card_title: data.card_title ?? 'Code Analysis',
    key_concept: data.key_concept ?? '',
    what_this_code_does: data.what_this_code_does ?? '',
    debug_analysis: data.debug_analysis ?? '-',
    optimization: data.optimization ?? '-',
    linkedin_post: data.linkedin_post ?? '',
    is_public: data.is_public ?? true,
    created_at: data.created_at ?? new Date().toISOString(),
    
    // فیلدهای nullable با null-safe
    username: data.username ?? null,
    github_username: data.github_username ?? null,
    avatar_url: data.avatar_url ?? null,
    card_image_url: data.card_image_url ?? null,
    
    // ===== Legacy فیلدها =====
    code_walkthrough: data.code_walkthrough ?? null,
    what_works_well: data.what_works_well ?? null,
    bugs_and_risky_cases: data.bugs_and_risky_cases ?? null,
    edge_cases: data.edge_cases ?? null,
    performance_analysis: data.performance_analysis ?? null,
    security_analysis: data.security_analysis ?? null,
    production_readiness: data.production_readiness ?? null,
    recommended_improvements: data.recommended_improvements ?? null,
    improved_code: data.improved_code ?? null,
    suggested_tests: data.suggested_tests ?? null,
    scorecard: data.scorecard ?? null,
    final_verdict_summary: data.final_verdict_summary ?? null,
    final_verdict_approved: data.final_verdict_approved ?? null,
    final_verdict_next_steps: data.final_verdict_next_steps ?? null,
    line_explanations: data.line_explanations ?? null,
    generated_prompt: data.generated_prompt ?? null,
    
    // ===== NEW Advanced فیلدها =====
    findings: data.findings ?? null,
    execution_overview: data.execution_overview ?? null,
    architectural_observations: data.architectural_observations ?? null,
    recommended_actions: data.recommended_actions ?? null,
    suggested_tests_new: data.suggested_tests_new ?? null,
    complexity: data.complexity ?? null,
    scorecard_new: data.scorecard_new ?? null,
    verdict: data.verdict ?? null,
    limitations: data.limitations ?? null,
  };

  return snippet;
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

// ============================================================
// 🔥 تابع بررسی وجود Full Report
// ============================================================
function hasFullAnalysis(snippet: Snippet): boolean {
  return !!(
    snippet.code_walkthrough ||
    snippet.what_works_well ||
    snippet.bugs_and_risky_cases ||
    snippet.edge_cases ||
    snippet.performance_analysis ||
    snippet.security_analysis ||
    snippet.production_readiness ||
    snippet.recommended_improvements ||
    snippet.improved_code ||
    snippet.suggested_tests ||
    snippet.scorecard ||
    snippet.final_verdict_summary ||
    snippet.findings ||
    snippet.execution_overview ||
    snippet.architectural_observations ||
    snippet.recommended_actions ||
    snippet.suggested_tests_new ||
    snippet.complexity ||
    snippet.scorecard_new ||
    snippet.verdict ||
    snippet.limitations
  );
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

  // بررسی وجود Full Analysis
  const fullAnalysisExists = hasFullAnalysis(snippet);

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

        {/* ============================================================
            🔥 Full Analysis (شرطی)
            ============================================================ */}
        {fullAnalysisExists ? (
          <SnippetFullAnalysis snippet={snippet} renderJsonValue={renderJsonValue} />
        ) : (
          <div className="mt-8 pt-6 border-t border-[#313244]">
            <div className="bg-[#11111b] p-6 rounded-lg border border-[#313244] text-center">
              <p className="text-[#a6adc8] text-sm">
                📊 Full report has not been generated for this snippet yet.
              </p>
              <p className="text-[#6c7086] text-xs mt-2">
                Generate a full analysis to see detailed insights including code walkthrough, 
                performance analysis, security review, and more.
              </p>
            </div>
          </div>
        )}

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