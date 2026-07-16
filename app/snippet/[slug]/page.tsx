import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import { highlightCode } from '@/lib/shiki';
import { safeString } from '@/lib/utils';
import Link from 'next/link';
import CopyButton from './CopyButton';
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PageProps {
  params: Promise<{ slug: string }>;
}

// ===== Generate metadata with OG image =====
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  
  try {
    const { data: snippet } = await supabaseAdmin
      .from('snippets')
      .select('card_title, key_concept, username')
      .eq('slug', slug)
      .single();

    if (!snippet) {
      return {
        title: 'Snippet Not Found',
      };
    }

    const title = snippet.card_title || 'Shared Code Snippet';
    const description = snippet.key_concept 
      ? snippet.key_concept.substring(0, 150) + '...' 
      : 'View this code snippet and its analysis.';
    const username = snippet.username || 'Developer';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://Zbloue.vercel.app';
    const imageUrl = `${appUrl}/api/og-image?slug=${slug}&title=${encodeURIComponent(title)}&username=${encodeURIComponent(username)}`;

    return {
      title: `${title} | Zbloue`,
      description: description,
      openGraph: {
        title: title,
        description: description,
        type: 'article',
        url: `${appUrl}/snippet/${slug}`,
        images: [
          {
            url: imageUrl,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title: title,
        description: description,
        images: [imageUrl],
      },
    };
  } catch {
    return {
      title: 'Snippet | Zbloue',
    };
  }
}

export default async function SnippetPage({ params }: PageProps) {
  const { slug } = await params;

  try {
    const { data: snippet, error } = await supabaseAdmin
      .from('snippets')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !snippet) {
      console.error('Database fetch error or snippet not found:', error);
      notFound();
    }

    let highlightedHtml = '';
    try {
      highlightedHtml = await highlightCode(snippet.raw_code, snippet.language);
    } catch (highlightError) {
      console.error('Highlight error:', highlightError);
      highlightedHtml = `<pre class="text-[#cdd6f4] p-4">${safeString(snippet.raw_code)}</pre>`;
    }

    const formattedDate = new Date(snippet.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://Zbloue.vercel.app';
    const shareUrl = `${appUrl}/snippet/${slug}`;

    const isFullAnalysis = snippet.debug_analysis !== '-';

    const renderJsonValue = (value: any): string => {
      if (typeof value === 'string') return value;
      if (typeof value === 'object' && value !== null) {
        try {
          return JSON.stringify(value, null, 2);
        } catch {
          return String(value);
        }
      }
      return String(value || 'Not specified');
    };

    const fullText = `${snippet.card_title || 'Code Analysis'} - Analyze your code with AI and share it with the world! #Zbloue #CodeReview #AI #Developer`;

    const shareUrls = {
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(fullText)}&url=${encodeURIComponent(shareUrl)}`,
      whatsapp: `https://api.whatsapp.com/send?text=${encodeURIComponent(fullText + ' ' + shareUrl)}`,
      telegram: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(snippet.card_title || 'Code Analysis')}`
    };

    const hasUserInfo = snippet.username || snippet.github_username;

    // ===== تشخیص وجود فیلدهای جدید =====
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
      <main className="min-h-screen bg-[#0f0f14] text-[#cdd6f4] p-4 md:p-8 flex flex-col items-center">
        <div className="max-w-4xl w-full">
          
          {/* ===== HEADER ===== */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <Link href="/" className="text-[#89b4fa] hover:text-[#b4befe] transition-colors inline-flex items-center gap-2 text-sm font-medium">
              ← Back to Home
            </Link>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#a6adc8]">Share this page:</span>
              <CopyButton text={shareUrl} label="📋 Copy Page Link" />
            </div>
          </div>

          {/* ===== MAIN CARD ===== */}
          <div className="bg-[#1e1e2e] rounded-xl p-6 md:p-8 shadow-2xl border border-[#313244] space-y-6">
            
            {/* ===== Title & User Info ===== */}
            <div>
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">
                    {safeString(snippet.card_title || 'Code Analysis')}
                  </h1>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[#a6adc8] text-xs md:text-sm">
                    <span className="bg-[#313244] px-2.5 py-0.5 rounded-full text-[#cba6f7] font-semibold">
                      {safeString(snippet.language).toUpperCase()}
                    </span>
                    <span>•</span>
                    <span>Published: {formattedDate}</span>
                  </div>
                </div>

                {hasUserInfo && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#313244] bg-[#11111b] shrink-0">
                    <img 
                      src={`https://ui-avatars.com/api/?name=${encodeURIComponent(snippet.username || 'Developer')}&background=4a86f7&color=fff&size=32&bold=true`}
                      alt={snippet.username || 'Developer'}
                      className="w-6 h-6 rounded-full"
                    />
                    <span className="text-sm font-medium text-white">
                      {safeString(snippet.username || 'Developer')}
                    </span>
                    {snippet.github_username && (
                      <a
                        href={`https://github.com/${snippet.github_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#a6adc8] hover:text-white transition-colors"
                        title={`GitHub: ${snippet.github_username}`}
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.15 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.62.24 2.85.12 3.15.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                        </svg>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ===== SOURCE CODE ===== */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-[#89b4fa]">💻 Source Code</span>
                <CopyButton text={snippet.raw_code || ''} label="📄 Copy Code" />
              </div>
              <div className="bg-[#11111b] rounded-lg overflow-x-auto max-h-[500px] border border-[#313244] font-mono text-sm leading-relaxed">
                <div dangerouslySetInnerHTML={{ __html: highlightedHtml }} className="p-4" />
              </div>
            </div>

            {/* ===== BASIC ANALYSIS SECTIONS ===== */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#313244]">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-[#89b4fa] flex items-center gap-2">
                  💡 Key Concept
                </h3>
                <p className="text-[#a6adc8] text-sm leading-relaxed whitespace-pre-wrap">
                  {safeString(snippet.key_concept || 'No key concept provided.')}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-[#89b4fa] flex items-center gap-2">
                  🔍 What This Code Does
                </h3>
                <p className="text-[#a6adc8] text-sm leading-relaxed whitespace-pre-wrap">
                  {safeString(snippet.what_this_code_does || 'No description available.')}
                </p>
              </div>
            </div>

            {/* ===== DEBUG & OPTIMIZATION ===== */}
            {(snippet.debug_analysis && snippet.debug_analysis !== '-') || 
             (snippet.optimization && snippet.optimization !== '-') ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[#313244]">
                {snippet.debug_analysis && snippet.debug_analysis !== '-' && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-[#f38ba8]">🐛 Debug Analysis</h3>
                    <p className="text-[#a6adc8] text-sm leading-relaxed whitespace-pre-wrap">
                      {safeString(snippet.debug_analysis)}
                    </p>
                  </div>
                )}

                {snippet.optimization && snippet.optimization !== '-' && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-[#a6e3a1]">⚡ Optimization</h3>
                    <p className="text-[#a6adc8] text-sm leading-relaxed whitespace-pre-wrap">
                      {safeString(snippet.optimization)}
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            {/* ===== ADVANCED ANALYSIS (NEW FIELDS) ===== */}
            {hasAdvancedAnalysis && (
              <div className="pt-6 border-t border-[#313244]">
                <h2 className="text-2xl font-bold text-white mb-4">📊 Advanced Analysis</h2>
                
                <div className="space-y-4 text-[#cdd6f4]">
                  
                  {/* Code Walkthrough */}
                  {snippet.code_walkthrough && snippet.code_walkthrough.length > 0 && (
                    <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
                      <h3 className="text-lg font-semibold text-[#89b4fa]">🧩 Code Walkthrough</h3>
                      <div className="space-y-2 mt-2">
                        {snippet.code_walkthrough.map((item: any, idx: number) => (
                          <div key={idx} className="border-b border-[#313244] pb-2 last:border-0">
                            <p className="font-medium text-[#cdd6f4]">{item.section}</p>
                            <p className="text-[#a6adc8] text-sm">{item.explanation}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* What Works Well */}
                  {snippet.what_works_well && snippet.what_works_well.length > 0 && (
                    <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
                      <h3 className="text-lg font-semibold text-[#a6e3a1]">✅ What Works Well</h3>
                      <ul className="list-disc list-inside text-[#a6adc8] text-sm mt-2">
                        {snippet.what_works_well.map((item: string, idx: number) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Bugs and Risky Cases */}
                  {snippet.bugs_and_risky_cases && snippet.bugs_and_risky_cases.length > 0 && (
                    <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
                      <h3 className="text-lg font-semibold text-[#f38ba8]">🐛 Bugs and Risky Cases</h3>
                      <div className="space-y-2 mt-2">
                        {snippet.bugs_and_risky_cases.map((item: any, idx: number) => (
                          <div key={idx} className="border-b border-[#313244] pb-2 last:border-0">
                            <p className="font-medium text-[#cdd6f4]">{item.issue}</p>
                            <p className="text-[#a6adc8] text-sm">Impact: {item.impact}</p>
                            {item.example && <p className="text-[#a6adc8] text-xs">Example: {item.example}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Edge Cases */}
                  {snippet.edge_cases && snippet.edge_cases.length > 0 && (
                    <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
                      <h3 className="text-lg font-semibold text-[#89b4fa]">🧪 Edge Cases</h3>
                      <div className="space-y-2 mt-2">
                        {snippet.edge_cases.map((item: any, idx: number) => (
                          <div key={idx} className="border-b border-[#313244] pb-2 last:border-0">
                            <p className="font-medium text-[#cdd6f4]">{item.case}</p>
                            <p className="text-[#a6adc8] text-sm">Current: {item.currentBehavior}</p>
                            <p className="text-[#a6adc8] text-sm">Expected: {item.expectedBehavior}</p>
                            <p className="text-[#a6adc8] text-xs">Risk: {item.risk}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Performance Analysis */}
                  {snippet.performance_analysis && (
                    <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
                      <h3 className="text-lg font-semibold text-[#89b4fa]">⚡ Performance Analysis</h3>
                      <div className="space-y-1 mt-2 text-[#a6adc8] text-sm">
                        {snippet.performance_analysis.timeComplexity && (
                          <div>
                            <span className="font-medium">Time:</span>{' '}
                            {snippet.performance_analysis.timeComplexity.map((t: any) => 
                              `${t.target}: ${t.complexity}`
                            ).join(', ')}
                          </div>
                        )}
                        {snippet.performance_analysis.spaceComplexity && (
                          <div>
                            <span className="font-medium">Space:</span>{' '}
                            {snippet.performance_analysis.spaceComplexity.map((t: any) => 
                              `${t.target}: ${t.complexity}`
                            ).join(', ')}
                          </div>
                        )}
                        {snippet.performance_analysis.scalabilityNotes && (
                          <ul className="list-disc list-inside">
                            {snippet.performance_analysis.scalabilityNotes.map((note: string, idx: number) => (
                              <li key={idx}>{note}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Security Analysis */}
                  {snippet.security_analysis && (
                    <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
                      <h3 className="text-lg font-semibold text-[#f38ba8]">🔒 Security Analysis</h3>
                      <div className="space-y-1 mt-2 text-[#a6adc8] text-sm">
                        <p>Severity: {snippet.security_analysis.severity}</p>
                        {snippet.security_analysis.issues && snippet.security_analysis.issues.length > 0 && (
                          <div>
                            <span className="font-medium">Issues:</span>
                            <ul className="list-disc list-inside">
                              {snippet.security_analysis.issues.map((issue: string, idx: number) => (
                                <li key={idx}>{issue}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {snippet.security_analysis.recommendations && snippet.security_analysis.recommendations.length > 0 && (
                          <div>
                            <span className="font-medium">Recommendations:</span>
                            <ul className="list-disc list-inside">
                              {snippet.security_analysis.recommendations.map((rec: string, idx: number) => (
                                <li key={idx}>{rec}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Production Readiness */}
                  {snippet.production_readiness && (
                    <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
                      <h3 className="text-lg font-semibold text-[#89b4fa]">🛡️ Production Readiness</h3>
                      <div className="mt-2 text-[#a6adc8] text-sm">
                        <p>Ready: {snippet.production_readiness.isProductionReady ? '✅ Yes' : '❌ No'}</p>
                        {snippet.production_readiness.reasons && snippet.production_readiness.reasons.length > 0 && (
                          <div>
                            <span className="font-medium">Reasons:</span>
                            <ul className="list-disc list-inside">
                              {snippet.production_readiness.reasons.map((reason: string, idx: number) => (
                                <li key={idx}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {snippet.production_readiness.requiredChanges && snippet.production_readiness.requiredChanges.length > 0 && (
                          <div>
                            <span className="font-medium">Required Changes:</span>
                            <ul className="list-disc list-inside">
                              {snippet.production_readiness.requiredChanges.map((change: string, idx: number) => (
                                <li key={idx}>{change}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Recommended Improvements */}
                  {snippet.recommended_improvements && snippet.recommended_improvements.length > 0 && (
                    <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
                      <h3 className="text-lg font-semibold text-[#a6e3a1]">🔧 Recommended Improvements</h3>
                      <div className="space-y-2 mt-2">
                        {snippet.recommended_improvements.map((item: any, idx: number) => (
                          <div key={idx} className="border-b border-[#313244] pb-2 last:border-0">
                            <p className="font-medium text-[#cdd6f4]">[{item.priority}] {item.improvement}</p>
                            <p className="text-[#a6adc8] text-sm">Reason: {item.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Scorecard */}
                  {snippet.scorecard && (
                    <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
                      <h3 className="text-lg font-semibold text-[#89b4fa]">📊 Scorecard</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                        {Object.entries(snippet.scorecard).map(([key, value]) => (
                          <div key={key} className="bg-[#1e1e2e] p-2 rounded-md text-center border border-[#313244]">
                            <p className="text-xs text-[#6c7086] capitalize">
                              {key.replace(/([A-Z])/g, ' $1')}
                            </p>
                            <p className="text-lg font-bold text-white">{typeof value === 'number' ? value : 0}/10</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Final Verdict */}
                  {snippet.final_verdict_summary && (
                    <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
                      <h3 className="text-lg font-semibold text-[#89b4fa]">🏁 Final Verdict</h3>
                      <p className="mt-2 text-[#a6adc8]"><strong>Summary:</strong> {snippet.final_verdict_summary}</p>
                      {snippet.final_verdict_approved !== undefined && (
                        <p className="text-[#a6adc8]"><strong>Approved:</strong> {snippet.final_verdict_approved ? '✅ Yes' : '❌ No'}</p>
                      )}
                      {snippet.final_verdict_next_steps && (
                        <p className="text-[#a6adc8]"><strong>Next Steps:</strong> {snippet.final_verdict_next_steps}</p>
                      )}
                    </div>
                  )}

                  {/* Improved Code */}
                  {snippet.improved_code && (
                    <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
                      <h3 className="text-lg font-semibold text-[#89b4fa]">✨ Improved Code</h3>
                      <pre className="text-[#cdd6f4] text-sm whitespace-pre-wrap overflow-auto max-h-[400px] mt-2 bg-[#0a0a0a] p-3 rounded">
                        {snippet.improved_code}
                      </pre>
                    </div>
                  )}

                  {/* Suggested Tests */}
                  {snippet.suggested_tests && snippet.suggested_tests.length > 0 && (
                    <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
                      <h3 className="text-lg font-semibold text-[#89b4fa]">🧪 Suggested Tests</h3>
                      <div className="space-y-2 mt-2">
                        {snippet.suggested_tests.map((test: any, idx: number) => (
                          <div key={idx} className="border-b border-[#313244] pb-2 last:border-0">
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

            {/* ===== LINE BY LINE EXPLANATIONS ===== */}
            {hasLineExplanations && (
              <div className="pt-6 border-t border-[#313244]">
                <h2 className="text-2xl font-bold text-white mb-4">📝 Line-by-Line Explanations</h2>
                <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {snippet.line_explanations.map((item: any, idx: number) => (
                      <div key={idx} className="border-b border-[#313244] pb-2 last:border-0">
                        <p className="font-mono text-sm text-[#cdd6f4]">Line {item.lineNumber}: {item.code}</p>
                        <p className="text-[#a6adc8] text-sm">💡 {item.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ===== GENERATED PROMPT ===== */}
            {hasGeneratedPrompt && (
              <div className="pt-6 border-t border-[#313244]">
                <h2 className="text-2xl font-bold text-white mb-4">📝 Generated Prompt</h2>
                <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
                  <div className="bg-[#0a0a0a] p-3 rounded text-[#cdd6f4] text-sm whitespace-pre-wrap max-h-[400px] overflow-y-auto">
                    {snippet.generated_prompt}
                  </div>
                </div>
              </div>
            )}

            {/* ===== LINKEDIN POST ===== */}
            <div className="pt-6 border-t border-[#313244] space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-[#fab387] flex items-center gap-2">
                  💼 LinkedIn Post
                </h3>
                <CopyButton text={snippet.linkedin_post || ''} label="🔗 Copy Post" />
              </div>
              <div className="bg-[#11111b] p-4 rounded-lg text-[#cdd6f4] text-sm whitespace-pre-wrap leading-relaxed border border-[#313244]">
                {safeString(snippet.linkedin_post || 'No LinkedIn post available.')}
              </div>
            </div>

            {/* ===== SOCIAL SHARE BUTTONS ===== */}
            <div className="pt-6 border-t border-[#313244] space-y-3">
              <h3 className="text-lg font-semibold text-[#89b4fa] flex items-center gap-2">
                🌐 Share This Analysis
              </h3>
              <div className="flex flex-wrap gap-2">
                <a
                  href={shareUrls.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#0a66c2] hover:bg-[#004182] text-white px-4 py-2 rounded-md text-sm transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  LinkedIn
                </a>
                <a
                  href={shareUrls.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#1DA1F2] hover:bg-[#0d8bdb] text-white px-4 py-2 rounded-md text-sm transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  Twitter
                </a>
                <a
                  href={shareUrls.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#25D366] hover:bg-[#1da851] text-white px-4 py-2 rounded-md text-sm transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </a>
                <a
                  href={shareUrls.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-[#0088cc] hover:bg-[#006699] text-white px-4 py-2 rounded-md text-sm transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                  Telegram
                </a>
              </div>
            </div>

            {/* ===== PROJECT FOOTER ===== */}
            <div className="mt-8 pt-6 border-t border-[#313244]">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#a6adc8]">
                <div className="flex flex-col sm:flex-row items-center gap-2 text-center sm:text-left">
                  <span className="text-lg">💻</span>
                  <span>
                    Built with{' '}
                    <a
                      href={process.env.NEXT_PUBLIC_APP_URL || 'https://Zbloue.vercel.app'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#89b4fa] hover:text-[#b4befe] transition-colors font-semibold hover:underline"
                    >
                      Zbloue
                    </a>
                  </span>
                  <span className="hidden sm:inline text-[#6c7086]">·</span>
                  <a
                    href={process.env.NEXT_PUBLIC_APP_URL || 'https://Zbloue.vercel.app'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#6c7086] font-mono break-all hover:text-[#89b4fa] transition-colors hover:underline"
                  >
                    {process.env.NEXT_PUBLIC_APP_URL || 'https://Zbloue.vercel.app'}
                  </a>
                  <span className="text-[#6c7086]">·</span>
                  <a
                    href={process.env.NEXT_PUBLIC_GITHUB_URL || 'https://github.com/sadat006363/Zbloue'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#89b4fa] hover:text-[#b4befe] transition-colors flex items-center gap-1 hover:underline"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.15 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.62.24 2.85.12 3.15.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                    GitHub
                  </a>
                </div>
                <div className="text-xs text-[#6c7086]">
                  <span>✨ Share your code. Get insights. Grow your network.</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    );
  } catch (error) {
    console.error('Error loading snippet:', error);
    notFound();
  }
}