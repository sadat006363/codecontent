// app/snippet/[slug]/page.tsx
import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import { highlightCode } from '@/lib/shiki';
import { safeString, getScoreLabel } from '@/lib/utils';
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
import AnalysisTab from '@/components/OutputPanel/tabs/AnalysisTab';

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
      .select('card_title, key_concept, username, card_image_url, avatar_url')
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
      simple: { label: '⚡ Simple Analysis', color: 'bg-blue-100 text-blue-800 border-blue-300' },
      medium: { label: '📊 Medium Analysis', color: 'bg-purple-100 text-purple-800 border-purple-300' },
      advanced: { label: '🔬 Advanced Analysis', color: 'bg-green-100 text-green-800 border-green-300' },
    }[isAdvanced ? 'advanced' : isMedium ? 'medium' : 'simple'];

    let highlightedHtml = '';
    try {
      highlightedHtml = await highlightCode(snippet.raw_code, snippet.language);
    } catch {
      highlightedHtml = `<pre class="text-gray-800 p-4">${safeString(snippet.raw_code)}</pre>`;
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
    const hasAdvancedAnalysis = !!(snippet.code_walkthrough || snippet.what_works_well || snippet.bugs_and_risky_cases || snippet.edge_cases || snippet.performance_analysis || snippet.security_analysis || snippet.production_readiness || snippet.recommended_improvements || snippet.improved_code || snippet.suggested_tests || snippet.scorecard || snippet.final_verdict_summary);

    const hasLineExplanations = snippet.line_explanations && snippet.line_explanations.length > 0;
    const hasGeneratedPrompt = snippet.generated_prompt;

    // ===== Build fullAnalysis from both legacy and new fields =====
    let fullAnalysis = null;
    if (isAdvanced) {
      fullAnalysis = {
        title: snippet.card_title || 'Code Analysis',
        summary: snippet.final_verdict_summary || undefined,
        highLevelSummary: snippet.key_concept || undefined,
        codeWalkthrough: snippet.code_walkthrough,
        whatWorksWell: snippet.what_works_well,
        bugsAndRiskyCases: snippet.bugs_and_risky_cases,
        edgeCases: snippet.edge_cases,
        performanceAnalysis: snippet.performance_analysis,
        securityAnalysis: snippet.security_analysis,
        productionReadiness: snippet.production_readiness,
        recommendedImprovements: snippet.recommended_improvements,
        improvedCode: snippet.improved_code ? { available: true, code: snippet.improved_code, notes: '' } : null,
        suggestedTestsLegacy: snippet.suggested_tests,
        scorecardLegacy: snippet.scorecard,
        finalVerdict: snippet.final_verdict_summary ? {
          summary: snippet.final_verdict_summary,
          approved: snippet.final_verdict_approved ?? false,
          nextSteps: snippet.final_verdict_next_steps || '',
        } : undefined,
        linkedin_post: snippet.linkedin_post || '',
        analysis: snippet.what_this_code_does || '',
        // ===== NEW Advanced fields from database =====
        findings: snippet.findings,
        executionOverview: snippet.execution_overview,
        architecturalObservations: snippet.architectural_observations,
        recommendedActions: snippet.recommended_actions,
        suggestedTests: snippet.suggested_tests_new,
        complexity: snippet.complexity,
        scorecard: snippet.scorecard_new,
        verdict: snippet.verdict,
        limitations: snippet.limitations,
        auditType: 'concurrency',
        status: 'complete',
        language: snippet.language,
        schemaVersion: '1.0',
      };
    }

    const topBugs = snippet.bugs_and_risky_cases?.slice(0, 3) || [];
    const topImprovements = snippet.recommended_improvements?.slice(0, 3) || [];

    const getBugExplanation = (issue: string): string => {
      const issueStr = safeString(issue);
      if (issueStr.includes('off-by-one') || issueStr.includes('i <=') || issueStr.includes('i <')) {
        return '💡 The loop runs one extra time, causing incorrect calculations.';
      }
      if (issueStr.includes('validation') || issueStr.includes('validate') || issueStr.includes('input')) {
        return '💡 Inputs are used without validation, which may cause runtime errors.';
      }
      if (issueStr.includes('null') || issueStr.includes('undefined') || issueStr.includes('empty')) {
        return '💡 The code does not handle empty or unexpected inputs gracefully.';
      }
      if (issueStr.includes('security') || issueStr.includes('password') || issueStr.includes('hash')) {
        return '💡 This security issue could lead to system vulnerabilities.';
      }
      return '💡 This issue could cause incorrect behavior in specific situations.';
    };

    const getKindVerdict = (verdict: any) => {
      if (!verdict) {
        return {
          summary: 'Your code has a good structure and with a few improvements it can be excellent.',
          approved: true,
          nextSteps: 'Check the "Top 3 Fixes" section and start improving step by step.',
        };
      }
      const isApproved = verdict.approved;
      const summary = isApproved
        ? `✅ Your code is in good shape! ${safeString(verdict.summary) || 'It has many positive aspects.'}`
        : `🔧 Your code has good potential. ${safeString(verdict.summary) || 'Fixing a few simple issues will greatly improve its quality.'}`;
      const nextSteps = isApproved
        ? '💪 To make your code even more professional, review the "Recommended Improvements" section.'
        : '🚀 Start with the "Top 3 Fixes" and then work through the rest.';
      return {
        summary,
        approved: isApproved,
        nextSteps,
      };
    };

    const kindVerdict = getKindVerdict({
      summary: snippet.final_verdict_summary,
      approved: snippet.final_verdict_approved,
      nextSteps: snippet.final_verdict_next_steps,
    });

    return (
      <main className="min-h-screen bg-gray-50 text-gray-800 p-4 md:p-6 flex flex-col items-center">
        <div className="w-full max-w-[1400px] mx-auto space-y-6">

          {/* ===== HEADER ===== */}
          <div className="bg-white shadow-sm rounded-2xl border border-gray-200 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 md:p-4 border-b border-gray-100">
              <div className="flex items-center gap-3 flex-wrap">
                <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0">
                  <span className="text-xl font-bold text-blue-600">Zbloue</span>
                  <span className="text-xs text-gray-400 hidden sm:inline">| AI Code Analysis</span>
                </Link>
                {hasUserInfo && (
                  <div className="flex items-center gap-2 ml-2 pl-3 border-l border-gray-200">
                    {snippet.avatar_url ? (
                      <img src={snippet.avatar_url} alt={snippet.username || 'User'} className="w-8 h-8 rounded-full object-cover border-2 border-blue-400" />
                    ) : snippet.username ? (
                      <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(snippet.username)}&background=4a86f7&color=fff&size=32&bold=true`} alt={snippet.username} className="w-8 h-8 rounded-full" />
                    ) : null}
                    {snippet.username && <span className="text-sm font-medium text-gray-700">{safeString(snippet.username)}</span>}
                    {snippet.github_username && (
                      <a href={`https://github.com/${snippet.github_username}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 transition-colors" title={`GitHub: ${snippet.github_username}`}>
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.15 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.62.24 2.85.12 3.15.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                      </a>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-400 hidden sm:inline">Share:</span>
                <a href={shareUrls.linkedin} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gray-100 transition" title="LinkedIn">
                  <svg className="w-6 h-6 text-[#0a66c2]" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
                <a href={shareUrls.twitter} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gray-100 transition" title="Twitter">
                  <svg className="w-6 h-6 text-[#1DA1F2]" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                </a>
                <a href={shareUrls.whatsapp} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gray-100 transition" title="WhatsApp">
                  <svg className="w-6 h-6 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </a>
                <a href={shareUrls.telegram} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gray-100 transition" title="Telegram">
                  <svg className="w-6 h-6 text-[#0088cc]" fill="currentColor" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                </a>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 p-3 md:p-4">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 tracking-tight">
                {safeString(snippet.card_title || 'Code Analysis')}
              </h1>
              <span className={`text-xs px-3 py-1 rounded-full border font-medium ${modeBadge.color}`}>
                {modeBadge.label}
              </span>
              <span className="text-xs text-gray-400 ml-auto">
                {safeString(snippet.language).toUpperCase()} • {formattedDate} • {snippet.raw_code.split('\n').length} lines
              </span>
            </div>
          </div>

          {/* ===== 1. Executive Summary ===== */}
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <p className="text-gray-800 text-sm leading-relaxed">
              💡 <strong>Summary:</strong>{' '}
              {safeString(snippet.final_verdict_summary || 'Your code has a solid structure and with a few tweaks can reach a professional level.')}
              {isAdvanced && snippet.final_verdict_approved !== undefined && (
                <span className="ml-2">
                  {snippet.final_verdict_approved ? '✅ Overall status: Acceptable' : '🔧 Overall status: Needs improvement'}
                </span>
              )}
            </p>
          </div>

          {/* ===== 2. Top 3 Fixes ===== */}
          {(topBugs.length > 0 || topImprovements.length > 0) && (
            <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200">
              <h3 className="text-yellow-800 font-semibold mb-3 text-base">🚨 Top 3 things to fix first:</h3>
              <ol className="space-y-3 text-sm text-gray-800 list-decimal list-inside">
                {topBugs.map((bug: BugAndRiskyCase, idx: number) => (
                  <li key={idx} className="border-b border-gray-200 pb-2 last:border-0">
                    <div className="flex flex-col gap-1">
                      <div>
                        <span className="font-medium text-red-600">{safeString(bug.issue)}</span>
                        <span className="text-xs text-gray-500 ml-2">(Impact: {safeString(bug.impact || 'Medium')})</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {getBugExplanation(safeString(bug.issue))}
                        {bug.example && <span className="block mt-1 text-gray-500">Example: {safeString(bug.example)}</span>}
                      </p>
                    </div>
                  </li>
                ))}
                {topBugs.length < 3 && topImprovements.slice(0, 3 - topBugs.length).map((imp: RecommendedImprovement, idx: number) => (
                  <li key={idx} className="border-b border-gray-200 pb-2 last:border-0">
                    <div className="flex flex-col gap-1">
                      <div>
                        <span className="font-medium text-green-600">[{safeString(imp.priority)}] {safeString(imp.improvement)}</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        💡 {safeString(imp.reason || 'This improvement will boost your code quality.')}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* ===== 3. Source Code ===== */}
          <div className="bg-white shadow-sm rounded-2xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
              <span className="text-sm font-semibold text-blue-600">💻 Source Code</span>
            </div>
            <div className="p-4 overflow-x-auto max-h-[600px] font-mono text-sm leading-relaxed bg-white">
              <div dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
            </div>
          </div>

          {/* ===== 4. Friendly Scorecard ===== */}
          {snippet.scorecard && Object.keys(snippet.scorecard).length > 0 && (
            <div className="bg-white shadow-sm p-4 rounded-2xl border border-gray-200">
              <h3 className="text-gray-800 font-semibold mb-3 text-base">📊 Your Code Scorecard</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(snippet.scorecard).map(([key, value]) => {
                  const score = typeof value === 'number' ? value : 0;
                  const label = getScoreLabel(score);
                  const displayKey = key.replace(/([A-Z])/g, ' $1').trim();
                  return (
                    <div key={key} className={`bg-gray-50 p-3 rounded-lg text-center border border-gray-200 ${label.color}`}>
                      <p className="text-xs text-gray-500 capitalize">{displayKey}</p>
                      <p className="text-lg font-bold">{label.emoji} {label.label}</p>
                      <p className="text-xs text-gray-500">{score}/10</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== 5. Main Analysis Sections ===== */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white shadow-sm p-4 rounded-2xl border border-gray-200">
              <h3 className="text-lg font-semibold text-blue-600 flex items-center gap-2">💡 Key Concept</h3>
              <p className="text-gray-700 text-sm leading-relaxed mt-1">{safeString(snippet.key_concept || 'No key concept provided.')}</p>
            </div>
            <div className="bg-white shadow-sm p-4 rounded-2xl border border-gray-200">
              <h3 className="text-lg font-semibold text-blue-600 flex items-center gap-2">🔍 What This Code Does</h3>
              <p className="text-gray-700 text-sm leading-relaxed mt-1">{safeString(snippet.what_this_code_does || 'No description available.')}</p>
            </div>
          </div>

          {/* ===== 6. Debug & Optimization ===== */}
          {(isMedium || isAdvanced) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white shadow-sm p-4 rounded-2xl border border-gray-200">
                <h3 className="text-lg font-semibold text-red-600 flex items-center gap-2">🐛 Debug Analysis</h3>
                <p className="text-gray-700 text-sm leading-relaxed mt-1">
                  {isAdvanced
                    ? safeString(snippet.debug_analysis || 'No bugs identified.')
                    : safeString(extracted.debug || 'No debug information available.')}
                </p>
              </div>
              <div className="bg-white shadow-sm p-4 rounded-2xl border border-gray-200">
                <h3 className="text-lg font-semibold text-green-600 flex items-center gap-2">⚡ Optimization</h3>
                <p className="text-gray-700 text-sm leading-relaxed mt-1">
                  {isAdvanced
                    ? safeString(snippet.optimization || 'No improvements suggested.')
                    : safeString(extracted.optimization || 'No optimization suggestions available.')}
                </p>
              </div>
            </div>
          )}

          {/* ===== 7. Advanced Analysis (using AnalysisTab component) ===== */}
          {isAdvanced && fullAnalysis && (
            <div className="bg-white shadow-sm rounded-2xl border border-gray-200 p-4">
              <AnalysisTab
                fullAnalysis={fullAnalysis}
                isAdvanced={true}
                quickAnalysisText={null}
                snippet={snippet}
                onCopyFullAnalysis={() => {}}
                onDownloadFullAnalysis={() => {}}
              />
            </div>
          )}

          {/* ===== 8. Line-by-Line ===== */}
          {isAdvanced && hasLineExplanations && (
            <details className="bg-white shadow-sm rounded-2xl border border-gray-200 p-4 group open:pb-6 transition-all">
              <summary className="text-lg font-semibold text-gray-900 cursor-pointer list-none flex items-center justify-between">
                <span>📝 Line-by-Line Explanations</span>
                <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="mt-4 space-y-2 max-h-[500px] overflow-y-auto">
                {(snippet.line_explanations || []).map((item: LineExplanation, idx: number) => (
                  <div key={idx} className="border-b border-gray-200 pb-2 last:border-0">
                    <p className="font-mono text-sm text-gray-800">Line {item.lineNumber}: {safeString(item.code)}</p>
                    <p className="text-gray-600 text-sm">💡 {safeString(item.explanation)}</p>
                  </div>
                ))}
              </div>
            </details>
          )}

          {/* ===== 9. Prompt ===== */}
          {isAdvanced && hasGeneratedPrompt && (
            <details className="bg-white shadow-sm rounded-2xl border border-gray-200 p-4 group open:pb-6 transition-all">
              <summary className="text-lg font-semibold text-gray-900 cursor-pointer list-none flex items-center justify-between">
                <span>📝 Generated Prompt</span>
                <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="mt-4 bg-gray-50 p-4 rounded-xl text-gray-800 text-sm whitespace-pre-wrap max-h-[400px] overflow-y-auto border border-gray-200">
                {safeString(snippet.generated_prompt || 'No prompt generated.')}
              </div>
            </details>
          )}

          {/* ===== 10. LinkedIn Post ===== */}
          <div className="bg-white shadow-sm p-6 rounded-2xl border border-gray-200">
            <h3 className="text-lg font-semibold text-orange-600 flex items-center gap-2">💼 LinkedIn Post</h3>
            <p className="mt-2 text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">{safeString(snippet.linkedin_post || 'No LinkedIn post available.')}</p>
          </div>

          {/* ===== Footer ===== */}
          <div className="text-center text-xs text-gray-500 py-4 border-t border-gray-200">
            <p>✨ Built with <a href={appUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Zbloue</a></p>
          </div>

        </div>
      </main>
    );
  } catch (error) {
    if (process.env.NODE_ENV === 'development') console.error('Error loading snippet:', error);
    notFound();
  }
}