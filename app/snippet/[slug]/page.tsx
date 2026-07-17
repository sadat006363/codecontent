import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import { highlightCode } from '@/lib/shiki';
import { safeString } from '@/lib/utils';
import Link from 'next/link';
import { Metadata } from 'next';
import {
  CodeWalkthroughItem,
  BugAndRiskyCase,
  EdgeCase,
  RecommendedImprovement,
  SuggestedTest,
  Scorecard,
  LineExplanation,
} from '@/types';

export const dynamic = 'auto';
export const revalidate = 3600;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ tab?: string }>;
}

type ExtractedDebug = {
  debug: string | null;
  optimization: string | null;
};

const extractDebugAndOptimization = (text: string): ExtractedDebug => {
  if (!text) return { debug: null, optimization: null };
  const debugMatch = text.match(/### 🐛 Critical Issues\n([\s\S]*?)(?=\n###|$)/);
  const optimizationMatch = text.match(/### ⚡ Quick Fix\n([\s\S]*?)(?=\n###|$)/);
  return {
    debug: debugMatch ? debugMatch[1].trim() : null,
    optimization: optimizationMatch ? optimizationMatch[1].trim() : null,
  };
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { data: snippet } = await supabaseAdmin
      .from('snippets')
      .select('card_title, key_concept, username, card_image_url')
      .eq('slug', slug)
      .single();
    if (!snippet) return { title: 'Snippet Not Found' };
    const title = snippet.card_title || 'Shared Code Snippet';
    const description = snippet.key_concept
      ? snippet.key_concept.substring(0, 150) + '...'
      : 'View this code snippet and its analysis.';
    const username = snippet.username || 'Developer';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://Zbloue.vercel.app';
    const imageUrl = snippet.card_image_url || `${appUrl}/api/og-image?slug=${slug}&title=${encodeURIComponent(title)}&username=${encodeURIComponent(username)}`;
    return {
      title: `${title} | Zbloue`,
      description,
      openGraph: {
        title,
        description,
        type: 'article',
        url: `${appUrl}/snippet/${slug}`,
        images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [imageUrl],
      },
    };
  } catch {
    return { title: 'Snippet | Zbloue' };
  }
}

export default async function SnippetPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const tab = resolvedSearchParams?.tab || 'explanation';

  try {
    const { data: snippet, error } = await supabaseAdmin
      .from('snippets')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !snippet) {
      if (process.env.NODE_ENV === 'development') console.error('Fetch error:', error);
      notFound();
    }

    const isAdvanced = snippet.code_walkthrough && snippet.code_walkthrough.length > 0;
    const isMedium = snippet.debug_analysis && snippet.debug_analysis !== '-';
    const isSimple = !isAdvanced && !isMedium;

    const extracted: ExtractedDebug = isMedium
      ? extractDebugAndOptimization(snippet.what_this_code_does)
      : { debug: null, optimization: null };

    const modeBadge = {
      simple: { label: '⚡ Simple Analysis', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
      medium: { label: '📊 Medium Analysis', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
      advanced: { label: '🔬 Advanced Analysis', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
    }[isAdvanced ? 'advanced' : isMedium ? 'medium' : 'simple'];

    let highlightedHtml = '';
    try {
      highlightedHtml = await highlightCode(snippet.raw_code, snippet.language);
    } catch {
      highlightedHtml = `<pre class="text-[#cdd6f4] p-4">${safeString(snippet.raw_code)}</pre>`;
    }

    const formattedDate = new Date(snippet.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://Zbloue.vercel.app';
    const shareUrl = `${appUrl}/snippet/${slug}`;
    const fullText = `${snippet.card_title || 'Code Analysis'} - Analyze your code with AI and share it with the world! #Zbloue #CodeReview #AI #Developer`;

    const shareUrls = {
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(fullText)}&url=${encodeURIComponent(shareUrl)}`,
      whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(fullText + ' ' + shareUrl)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(snippet.card_title || 'Code Analysis')}`,
    };

    const hasUserInfo = snippet.username || snippet.github_username;
    const hasAdvancedAnalysis = snippet.code_walkthrough ||
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
      snippet.final_verdict_summary;

    const hasLineExplanations = snippet.line_explanations && snippet.line_explanations.length > 0;
    const hasGeneratedPrompt = snippet.generated_prompt;

    return (
      <main className="min-h-screen bg-gradient-to-br from-[#0f0f14] via-[#1a1a2e] to-[#0f0f14] text-[#cdd6f4] p-4 md:p-6 flex flex-col items-center">
        <div className="w-full max-w-[1400px] mx-auto space-y-6">

          {/* ===== HEADER ===== */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-[#89b4fa] hover:text-[#b4befe] transition-colors text-sm font-medium flex items-center gap-1">
                ← بازگشت
              </Link>
              <span className="text-[#6c7086]">|</span>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight truncate max-w-[300px] md:max-w-[500px]">
                  {safeString(snippet.card_title || 'Code Analysis')}
                </h1>
                <span className={`text-xs px-3 py-1 rounded-full border font-medium ${modeBadge.color}`}>
                  {modeBadge.label}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[#6c7086]">اشتراک‌گذاری:</span>
              <a href={shareUrls.linkedin} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-[#0a66c2]/20 hover:bg-[#0a66c2]/40 transition" title="LinkedIn">
                <svg className="w-5 h-5 text-[#0a66c2]" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
              </a>
              <a href={shareUrls.twitter} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-[#1DA1F2]/20 hover:bg-[#1DA1F2]/40 transition" title="Twitter">
                <svg className="w-5 h-5 text-[#1DA1F2]" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              <a href={shareUrls.whatsapp} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-[#25D366]/20 hover:bg-[#25D366]/40 transition" title="WhatsApp">
                <svg className="w-5 h-5 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </a>
              <a href={shareUrls.telegram} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-[#0088cc]/20 hover:bg-[#0088cc]/40 transition" title="Telegram">
                <svg className="w-5 h-5 text-[#0088cc]" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
              </a>
            </div>
          </div>

          {/* ===== اطلاعات کاربر و تاریخ ===== */}
          <div className="flex flex-wrap items-center gap-3 text-sm text-[#a6adc8] bg-white/5 backdrop-blur-sm p-3 rounded-xl border border-white/5">
            <span className="bg-[#313244] px-2.5 py-0.5 rounded-full text-[#cba6f7] font-semibold">
              {safeString(snippet.language).toUpperCase()}
            </span>
            <span>•</span>
            <span>📅 {formattedDate}</span>
            <span>•</span>
            <span>📄 {snippet.raw_code.split('\n').length} خط</span>
            {hasUserInfo && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(snippet.username || 'Developer')}&background=4a86f7&color=fff&size=24&bold=true`} alt="" className="w-5 h-5 rounded-full" />
                  {safeString(snippet.username || 'Developer')}
                </span>
              </>
            )}
          </div>

          {/* ===== کد منبع (زمینه هماهنگ با بقیه بخش‌ها) ===== */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
              <span className="text-sm font-semibold text-[#89b4fa]">💻 کد منبع</span>
            </div>
            <div className="p-4 overflow-x-auto max-h-[600px] font-mono text-sm leading-relaxed">
              <div dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
            </div>
          </div>

          {/* ===== بخش‌های تحلیل ===== */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
              <h3 className="text-lg font-semibold text-[#89b4fa] flex items-center gap-2">💡 Key Concept</h3>
              <p className="text-[#a6adc8] text-sm leading-relaxed mt-1">{safeString(snippet.key_concept || 'No key concept provided.')}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
              <h3 className="text-lg font-semibold text-[#89b4fa] flex items-center gap-2">🔍 What This Code Does</h3>
              <p className="text-[#a6adc8] text-sm leading-relaxed mt-1">{safeString(snippet.what_this_code_does || 'No description available.')}</p>
            </div>
          </div>

          {/* ===== Debug & Optimization ===== */}
          {(isMedium || isAdvanced) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                <h3 className="text-lg font-semibold text-[#f38ba8] flex items-center gap-2">🐛 Debug Analysis</h3>
                <p className="text-[#a6adc8] text-sm leading-relaxed mt-1">
                  {isAdvanced
                    ? safeString(snippet.debug_analysis || 'No bugs identified.')
                    : safeString(extracted.debug || 'No debug information available.')}
                </p>
              </div>
              <div className="bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
                <h3 className="text-lg font-semibold text-[#a6e3a1] flex items-center gap-2">⚡ Optimization</h3>
                <p className="text-[#a6adc8] text-sm leading-relaxed mt-1">
                  {isAdvanced
                    ? safeString(snippet.optimization || 'No improvements suggested.')
                    : safeString(extracted.optimization || 'No optimization suggestions available.')}
                </p>
              </div>
            </div>
          )}

          {/* ===== Advanced Analysis ===== */}
          {isAdvanced && hasAdvancedAnalysis && (
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 space-y-6">
              <h2 className="text-2xl font-bold text-white">📊 Advanced Analysis</h2>
              <div className="space-y-4">
                {snippet.code_walkthrough && snippet.code_walkthrough.length > 0 && (
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <h3 className="text-lg font-semibold text-[#89b4fa]">🧩 Code Walkthrough</h3>
                    <div className="space-y-2 mt-2">
                      {snippet.code_walkthrough.map((item: CodeWalkthroughItem, idx: number) => (
                        <div key={idx} className="border-b border-white/5 pb-2 last:border-0">
                          <p className="font-medium text-[#cdd6f4]">{item.section}</p>
                          <p className="text-[#a6adc8] text-sm">{item.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {snippet.what_works_well && snippet.what_works_well.length > 0 && (
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <h3 className="text-lg font-semibold text-[#a6e3a1]">✅ What Works Well</h3>
                    <ul className="list-disc list-inside text-[#a6adc8] text-sm mt-2">
                      {snippet.what_works_well.map((item: string, idx: number) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {snippet.bugs_and_risky_cases && snippet.bugs_and_risky_cases.length > 0 && (
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <h3 className="text-lg font-semibold text-[#f38ba8]">🐛 Bugs and Risky Cases</h3>
                    <div className="space-y-2 mt-2">
                      {snippet.bugs_and_risky_cases.map((item: BugAndRiskyCase, idx: number) => (
                        <div key={idx} className="border-b border-white/5 pb-2 last:border-0">
                          <p className="font-medium text-[#cdd6f4]">{item.issue}</p>
                          <p className="text-[#a6adc8] text-sm">Impact: {item.impact}</p>
                          {item.example && <p className="text-[#a6adc8] text-xs">Example: {item.example}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {snippet.edge_cases && snippet.edge_cases.length > 0 && (
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <h3 className="text-lg font-semibold text-[#89b4fa]">🧪 Edge Cases</h3>
                    <div className="space-y-2 mt-2">
                      {snippet.edge_cases.map((item: EdgeCase, idx: number) => (
                        <div key={idx} className="border-b border-white/5 pb-2 last:border-0">
                          <p className="font-medium text-[#cdd6f4]">{item.case}</p>
                          <p className="text-[#a6adc8] text-sm">Current: {item.currentBehavior}</p>
                          <p className="text-[#a6adc8] text-sm">Expected: {item.expectedBehavior}</p>
                          <p className="text-[#a6adc8] text-xs">Risk: {item.risk}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {snippet.performance_analysis && (
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <h3 className="text-lg font-semibold text-[#89b4fa]">⚡ Performance Analysis</h3>
                    <div className="mt-2 text-[#a6adc8] text-sm">
                      {snippet.performance_analysis.timeComplexity && (
                        <div><span className="font-medium">Time:</span> {snippet.performance_analysis.timeComplexity.map((t: any) => `${t.target}: ${t.complexity}`).join(', ')}</div>
                      )}
                      {snippet.performance_analysis.spaceComplexity && (
                        <div><span className="font-medium">Space:</span> {snippet.performance_analysis.spaceComplexity.map((t: any) => `${t.target}: ${t.complexity}`).join(', ')}</div>
                      )}
                      {snippet.performance_analysis.scalabilityNotes && (
                        <ul className="list-disc list-inside mt-1">{snippet.performance_analysis.scalabilityNotes.map((note: string, idx: number) => <li key={idx}>{note}</li>)}</ul>
                      )}
                    </div>
                  </div>
                )}
                {snippet.security_analysis && (
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <h3 className="text-lg font-semibold text-[#f38ba8]">🔒 Security Analysis</h3>
                    <div className="mt-2 text-[#a6adc8] text-sm">
                      <p>Severity: {snippet.security_analysis.severity}</p>
                      {snippet.security_analysis.issues && <ul className="list-disc list-inside">{snippet.security_analysis.issues.map((issue: string, idx: number) => <li key={idx}>{issue}</li>)}</ul>}
                      {snippet.security_analysis.recommendations && <ul className="list-disc list-inside">{snippet.security_analysis.recommendations.map((rec: string, idx: number) => <li key={idx}>{rec}</li>)}</ul>}
                    </div>
                  </div>
                )}
                {snippet.production_readiness && (
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <h3 className="text-lg font-semibold text-[#89b4fa]">🛡️ Production Readiness</h3>
                    <div className="mt-2 text-[#a6adc8] text-sm">
                      <p>Ready: {snippet.production_readiness.isProductionReady ? '✅ Yes' : '❌ No'}</p>
                      <ul className="list-disc list-inside">{snippet.production_readiness.reasons?.map((reason: string, idx: number) => <li key={idx}>{reason}</li>)}</ul>
                    </div>
                  </div>
                )}
                {snippet.recommended_improvements && snippet.recommended_improvements.length > 0 && (
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <h3 className="text-lg font-semibold text-[#a6e3a1]">🔧 Recommended Improvements</h3>
                    <div className="space-y-2 mt-2">
                      {snippet.recommended_improvements.map((item: RecommendedImprovement, idx: number) => (
                        <div key={idx} className="border-b border-white/5 pb-2 last:border-0">
                          <p className="font-medium text-[#cdd6f4]">[{item.priority}] {item.improvement}</p>
                          <p className="text-[#a6adc8] text-sm">Reason: {item.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {snippet.scorecard && (
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <h3 className="text-lg font-semibold text-[#89b4fa]">📊 Scorecard</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                      {Object.entries(snippet.scorecard).map(([key, value]) => (
                        <div key={key} className="bg-white/5 p-2 rounded-md text-center border border-white/5">
                          <p className="text-xs text-[#6c7086] capitalize">{key.replace(/([A-Z])/g, ' $1')}</p>
                          <p className="text-lg font-bold text-white">{typeof value === 'number' ? value : 0}/10</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {snippet.final_verdict_summary && (
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <h3 className="text-lg font-semibold text-[#89b4fa]">🏁 Final Verdict</h3>
                    <p className="mt-2 text-[#a6adc8]"><strong>Summary:</strong> {snippet.final_verdict_summary}</p>
                    <p className="text-[#a6adc8]"><strong>Approved:</strong> {snippet.final_verdict_approved ? '✅ Yes' : '❌ No'}</p>
                    {snippet.final_verdict_next_steps && <p className="text-[#a6adc8]"><strong>Next Steps:</strong> {snippet.final_verdict_next_steps}</p>}
                  </div>
                )}
                {snippet.improved_code && (
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <h3 className="text-lg font-semibold text-[#89b4fa]">✨ Improved Code</h3>
                    <pre className="text-[#cdd6f4] text-sm whitespace-pre-wrap overflow-auto max-h-[400px] mt-2 bg-black/30 p-3 rounded">{snippet.improved_code}</pre>
                  </div>
                )}
                {snippet.suggested_tests && snippet.suggested_tests.length > 0 && (
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <h3 className="text-lg font-semibold text-[#89b4fa]">🧪 Suggested Tests</h3>
                    <div className="space-y-2 mt-2">
                      {snippet.suggested_tests.map((test: SuggestedTest, idx: number) => (
                        <div key={idx} className="border-b border-white/5 pb-2 last:border-0">
                          <p className="font-medium text-[#cdd6f4]">{test.name}</p>
                          <p className="text-[#a6adc8] text-sm">Input: {test.input}</p>
                          <p className="text-[#a6adc8] text-sm">Expected: {test.expectedOutput}</p>
                          <p className="text-[#a6adc8] text-xs">Type: {test.type}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== Line-by-Line ===== */}
          {isAdvanced && hasLineExplanations && (
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10">
              <h2 className="text-2xl font-bold text-white mb-4">📝 Line-by-Line Explanations</h2>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {snippet.line_explanations.map((item: LineExplanation, idx: number) => (
                  <div key={idx} className="border-b border-white/5 pb-2 last:border-0">
                    <p className="font-mono text-sm text-[#cdd6f4]">Line {item.lineNumber}: {item.code}</p>
                    <p className="text-[#a6adc8] text-sm">💡 {item.explanation}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== Prompt ===== */}
          {isAdvanced && hasGeneratedPrompt && (
            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10">
              <h2 className="text-2xl font-bold text-white mb-4">📝 Generated Prompt</h2>
              <div className="bg-black/30 p-4 rounded-xl text-[#cdd6f4] text-sm whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                {snippet.generated_prompt}
              </div>
            </div>
          )}

          {/* ===== LinkedIn Post ===== */}
          <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10">
            <h3 className="text-lg font-semibold text-[#fab387] flex items-center gap-2">💼 LinkedIn Post</h3>
            <p className="mt-2 text-[#cdd6f4] text-sm whitespace-pre-wrap leading-relaxed">{safeString(snippet.linkedin_post || 'No LinkedIn post available.')}</p>
          </div>

          {/* ===== فوتر ===== */}
          <div className="text-center text-xs text-[#6c7086] py-4 border-t border-white/5">
            <p>✨ Built with <a href={appUrl} target="_blank" rel="noopener noreferrer" className="text-[#89b4fa] hover:underline">Zbloue</a></p>
          </div>

        </div>
      </main>
    );
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Error loading snippet:', error);
    notFound();
  }
}