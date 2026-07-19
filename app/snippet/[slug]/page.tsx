// ============================================================
// 📁 فایل: app/snippet/[slug]/page.tsx
// ============================================================

import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase'; // ✅ اصلاح: import supabase به جای createClient
import {
  Snippet,
  GenerateResponse,
  CodeWalkthroughItem,
  BugAndRiskyCase,
  EdgeCase,
  PerformanceAnalysis,
  SecurityAnalysis,
  ProductionReadiness,
  RecommendedImprovement,
  SuggestedTest,
  ScorecardLegacy,
  LineExplanation,
} from '@/types';
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

interface PageProps {
  params: {
    slug: string;
  };
}

async function getSnippet(slug: string): Promise<Snippet | null> {
  // ✅ اصلاح: استفاده از supabase به جای createClient()
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

export default async function SnippetPage({ params }: PageProps) {
  const snippet = await getSnippet(params.slug);

  if (!snippet) {
    notFound();
  }

  // Parse JSON fields
  let fullAnalysis: GenerateResponse | null = null;
  let codeWalkthrough: CodeWalkthroughItem[] | null = null;
  let whatWorksWell: string[] | null = null;
  let bugsAndRiskyCases: BugAndRiskyCase[] | null = null;
  let edgeCases: EdgeCase[] | null = null;
  let performanceAnalysis: PerformanceAnalysis | null = null;
  let securityAnalysis: SecurityAnalysis | null = null;
  let productionReadiness: ProductionReadiness | null = null;
  let recommendedImprovements: RecommendedImprovement[] | null = null;
  let suggestedTests: SuggestedTest[] | null = null;
  let scorecard: ScorecardLegacy | null = null;
  let lineExplanations: LineExplanation[] | null = null;

  try {
    if (snippet.code_walkthrough) {
      codeWalkthrough = JSON.parse(snippet.code_walkthrough);
    }
  } catch {}
  try {
    if (snippet.what_works_well) {
      whatWorksWell = JSON.parse(snippet.what_works_well);
    }
  } catch {}
  try {
    if (snippet.bugs_and_risky_cases) {
      bugsAndRiskyCases = JSON.parse(snippet.bugs_and_risky_cases);
    }
  } catch {}
  try {
    if (snippet.edge_cases) {
      edgeCases = JSON.parse(snippet.edge_cases);
    }
  } catch {}
  try {
    if (snippet.performance_analysis) {
      performanceAnalysis = JSON.parse(snippet.performance_analysis);
    }
  } catch {}
  try {
    if (snippet.security_analysis) {
      securityAnalysis = JSON.parse(snippet.security_analysis);
    }
  } catch {}
  try {
    if (snippet.production_readiness) {
      productionReadiness = JSON.parse(snippet.production_readiness);
    }
  } catch {}
  try {
    if (snippet.recommended_improvements) {
      recommendedImprovements = JSON.parse(snippet.recommended_improvements);
    }
  } catch {}
  try {
    if (snippet.suggested_tests) {
      suggestedTests = JSON.parse(snippet.suggested_tests);
    }
  } catch {}
  try {
    if (snippet.scorecard) {
      scorecard = JSON.parse(snippet.scorecard);
    }
  } catch {}
  try {
    if (snippet.line_explanations) {
      lineExplanations = JSON.parse(snippet.line_explanations);
    }
  } catch {}

  // Build fullAnalysis object
  fullAnalysis = {
    title: snippet.card_title,
    highLevelSummary: snippet.key_concept,
    codeWalkthrough: codeWalkthrough || undefined,
    whatWorksWell: whatWorksWell || undefined,
    bugsAndRiskyCases: bugsAndRiskyCases || undefined,
    edgeCases: edgeCases || undefined,
    performanceAnalysis: performanceAnalysis || undefined,
    securityAnalysis: securityAnalysis || undefined,
    productionReadiness: productionReadiness || undefined,
    recommendedImprovements: recommendedImprovements || undefined,
    suggestedTestsLegacy: suggestedTests || undefined,
    scorecardLegacy: scorecard || undefined,
    finalVerdict: {
      summary: snippet.final_verdict_summary || '',
      approved: snippet.final_verdict_approved || false,
      nextSteps: snippet.final_verdict_next_steps || '',
    },
    linkedin_post: snippet.linkedin_post,
  };

  const hasFullAnalysis =
    fullAnalysis.codeWalkthrough ||
    fullAnalysis.whatWorksWell ||
    fullAnalysis.bugsAndRiskyCases ||
    fullAnalysis.edgeCases ||
    fullAnalysis.performanceAnalysis ||
    fullAnalysis.securityAnalysis ||
    fullAnalysis.productionReadiness ||
    fullAnalysis.recommendedImprovements ||
    fullAnalysis.suggestedTestsLegacy ||
    fullAnalysis.scorecardLegacy;

  const hasDebugAnalysis = snippet.debug_analysis && snippet.debug_analysis !== '-';
  const hasOptimization = snippet.optimization && snippet.optimization !== '-';

  return (
    <main className="min-h-screen bg-[#f8f9fa]">
      <div className="max-w-5xl mx-auto px-4 py-6 md:py-8">
        {/* Header */}
        <SnippetHeader snippet={snippet} />

        {/* User Info */}
        <SnippetUserInfo snippet={snippet} />

        {/* Share Buttons */}
        <SnippetShareButtons slug={snippet.slug} title={snippet.card_title} />

        {/* Tab Links */}
        <SnippetTabLinks
          hasCode={!!snippet.raw_code}
          hasAnalysis={hasFullAnalysis}
          hasDebug={hasDebugAnalysis}
          hasLinkedIn={!!snippet.linkedin_post}
        />

        {/* Code Section */}
        <SnippetCode
          code={snippet.raw_code}
          language={snippet.language}
          lineExplanations={lineExplanations || undefined}
        />

        {/* Full Analysis Section */}
        {hasFullAnalysis && (
          <SnippetFullAnalysis
            analysis={fullAnalysis}
            codeWalkthrough={codeWalkthrough}
            whatWorksWell={whatWorksWell}
            bugsAndRiskyCases={bugsAndRiskyCases}
            edgeCases={edgeCases}
            performanceAnalysis={performanceAnalysis}
            securityAnalysis={securityAnalysis}
            productionReadiness={productionReadiness}
            recommendedImprovements={recommendedImprovements}
            suggestedTests={suggestedTests}
            scorecard={scorecard}
          />
        )}

        {/* Analysis Section (Legacy) */}
        {snippet.what_this_code_does && snippet.what_this_code_does !== 'No analysis generated.' && (
          <SnippetAnalysis analysis={snippet.what_this_code_does} />
        )}

        {/* Debug Analysis Section */}
        {hasDebugAnalysis && (
          <SnippetDebug debugAnalysis={snippet.debug_analysis} />
        )}

        {/* Optimization Section */}
        {hasOptimization && (
          <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">🚀 Optimization</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{snippet.optimization}</p>
          </div>
        )}

        {/* LinkedIn Post Section */}
        {snippet.linkedin_post && (
          <SnippetLinkedIn linkedinPost={snippet.linkedin_post} />
        )}

        {/* Footer */}
        <SnippetFooter createdAt={snippet.created_at} />
      </div>
    </main>
  );
}