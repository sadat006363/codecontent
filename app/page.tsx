// app/page.tsx
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Editor from '@/components/Editor';
import OutputPanel from '@/components/OutputPanel/OutputPanel';
import { useAppContext } from '@/context';
import { analysisService } from '@/services/analysisService';
import { snippetService } from '@/services/snippetService';
import {
  type LegacyGenerateResponse,
  type Snippet,
  type AnalysisMode,
  type PromptInfo,
} from '@/types';
import {
  LegacyCodeWalkthroughItem,
  LegacyBugAndRiskyCase,
  LegacyEdgeCase,
  LegacyPerformanceAnalysis,
  LegacySecurityAnalysis,
  LegacyProductionReadiness,
  LegacyRecommendedImprovement,
  LegacySuggestedTest,
  LegacyScorecard,
} from '@/types';

// 🔥 جلوگیری از prerender در build
export const dynamic = 'force-dynamic';

// ============================================================
// 🔥 Helper: Convert legacy response to UI-friendly format
// ============================================================
function normalizeLegacyResponse(data: LegacyGenerateResponse): {
  card_title: string;
  key_concept: string;
  what_this_code_does: string;
  debug_analysis: string;
  optimization: string;
  linkedin_post: string;
  codeWalkthrough?: LegacyCodeWalkthroughItem[];
  whatWorksWell?: string[];
  bugsAndRiskyCases?: LegacyBugAndRiskyCase[];
  edgeCases?: LegacyEdgeCase[];
  performanceAnalysis?: LegacyPerformanceAnalysis;
  securityAnalysis?: LegacySecurityAnalysis;
  productionReadiness?: LegacyProductionReadiness;
  recommendedImprovements?: LegacyRecommendedImprovement[];
  improvedCode?: any;
  suggestedTests?: LegacySuggestedTest[];
  scorecard?: LegacyScorecard;
  finalVerdict?: { summary: string; approved: boolean; nextSteps?: string };
} {
  return {
    card_title: data.card_title || 'Code Analysis',
    key_concept: data.key_concept || data.analysis?.slice(0, 200) || 'No summary provided.',
    what_this_code_does: data.what_this_code_does || '',
    debug_analysis: data.debug_analysis || '-',
    optimization: data.optimization || '-',
    linkedin_post: data.linkedin_post || '',
    codeWalkthrough: data.codeWalkthrough,
    whatWorksWell: data.whatWorksWell,
    bugsAndRiskyCases: data.bugsAndRiskyCases,
    edgeCases: data.edgeCases,
    performanceAnalysis: data.performanceAnalysis,
    securityAnalysis: data.securityAnalysis,
    productionReadiness: data.productionReadiness,
    recommendedImprovements: data.recommendedImprovements,
    improvedCode: data.improvedCode,
    suggestedTests: data.suggestedTests,
    scorecard: data.scorecard,
    finalVerdict: data.finalVerdict,
  };
}

// ============================================================
// 🔥 Helper: Build PromptInfo from response
// ============================================================
function buildPromptInfo(
  mode: AnalysisMode,
  data: LegacyGenerateResponse,
  pipelineStatus: 'completed' | 'failed' | 'fallback' = 'completed'
): PromptInfo {
  // Try to detect if concurrency was applied using legacy fields
  const hasConcurrency = data.analysis?.toLowerCase().includes('concurrency') ||
    data.bugsAndRiskyCases?.some((b: any) => 
      b.issue?.toLowerCase().includes('thread') || 
      b.issue?.toLowerCase().includes('deadlock')
    ) ||
    false;

  return {
    mode,
    auditType: 'comprehensive',
    appliedSpecializations: hasConcurrency ? ['concurrency'] : [],
    completionStatus: 'complete',
    repairApplied: false,
    pipelineStatus,
  };
}

export default function HomePage() {
  const { state, dispatch } = useAppContext();
  const {
    code,
    language,
    mode,
    loading,
    outputs,
    username,
    githubUsername,
    avatarUrl,
    isConverting,
    isExplaining,
    isGeneratingPrompt,
    convertError,
    explainError,
    promptError,
    promptInfo,
  } = state;

  const outputPanelRef = useRef<{ setActiveTab: (tab: any) => void }>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setErrorMessage(null);
    dispatch({ type: 'SET_ERROR', payload: null });
  }, [dispatch]);

  // ===== Generate analysis =====
  const handleGenerate = useCallback(async () => {
    if (!code.trim()) {
      setErrorMessage('Please enter some code to analyze.');
      return;
    }

    clearError();
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const response = await analysisService.generate({
        code,
        language,
        mode,
      });

      if (response.error) {
        throw new Error(response.error);
      }

      const genData = response as LegacyGenerateResponse;
      const normalized = normalizeLegacyResponse(genData);

      // ===== Normalize user fields =====
      const normalizedUsername = username && username.trim() !== '' ? username : 'Developer';
      const normalizedGithubUsername = githubUsername && githubUsername.trim() !== '' ? githubUsername : undefined;
      const normalizedAvatarUrl = avatarUrl && avatarUrl.trim() !== '' ? avatarUrl : undefined;

      // ===== Build save data =====
      const saveData = {
        code: code,
        language,
        card_title: normalized.card_title,
        key_concept: normalized.key_concept,
        what_this_code_does: normalized.what_this_code_does,
        debug_analysis: normalized.debug_analysis,
        optimization: normalized.optimization,
        linkedin_post: normalized.linkedin_post,
        username: normalizedUsername,
        github_username: normalizedGithubUsername,
        avatar_url: normalizedAvatarUrl,
        code_walkthrough: normalized.codeWalkthrough,
        what_works_well: normalized.whatWorksWell,
        bugs_and_risky_cases: normalized.bugsAndRiskyCases,
        edge_cases: normalized.edgeCases,
        performance_analysis: normalized.performanceAnalysis,
        security_analysis: normalized.securityAnalysis,
        production_readiness: normalized.productionReadiness,
        recommended_improvements: normalized.recommendedImprovements,
        improved_code: normalized.improvedCode?.code,
        suggested_tests: normalized.suggestedTests,
        scorecard: normalized.scorecard,
        final_verdict_summary: normalized.finalVerdict?.summary,
        final_verdict_approved: normalized.finalVerdict?.approved,
        final_verdict_next_steps: normalized.finalVerdict?.nextSteps,
      };

      // ===== Save to database =====
      const saveResult = await snippetService.save(saveData);

      // ===== Check save success =====
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save snippet');
      }

      // ===== Build Snippet =====
      const snippetData: Snippet = {
        id: saveResult.id,
        slug: saveResult.slug,
        raw_code: code,
        language,
        card_title: normalized.card_title,
        key_concept: normalized.key_concept,
        what_this_code_does: normalized.what_this_code_does,
        debug_analysis: normalized.debug_analysis,
        optimization: normalized.optimization,
        linkedin_post: normalized.linkedin_post,
        is_public: true,
        created_at: new Date().toISOString(),
        username: saveResult.username || normalizedUsername,
        github_username: saveResult.github_username ?? normalizedGithubUsername,
        avatar_url: normalizedAvatarUrl, // 🔥 استفاده از مقدار نرمالایز شده
        card_image_url: undefined,
        code_walkthrough: normalized.codeWalkthrough,
        what_works_well: normalized.whatWorksWell,
        bugs_and_risky_cases: normalized.bugsAndRiskyCases,
        edge_cases: normalized.edgeCases,
        performance_analysis: normalized.performanceAnalysis,
        security_analysis: normalized.securityAnalysis,
        production_readiness: normalized.productionReadiness,
        recommended_improvements: normalized.recommendedImprovements,
        improved_code: normalized.improvedCode?.code,
        suggested_tests: normalized.suggestedTests,
        scorecard: normalized.scorecard,
        final_verdict_summary: normalized.finalVerdict?.summary,
        final_verdict_approved: normalized.finalVerdict?.approved,
        final_verdict_next_steps: normalized.finalVerdict?.nextSteps,
        findings: (genData as any).findings,
        execution_overview: (genData as any).executionOverview,
        architectural_observations: (genData as any).architecturalObservations,
        recommended_actions: (genData as any).recommendedActions,
        suggested_tests_new: (genData as any).suggestedTests,
        complexity: (genData as any).complexity,
        scorecard_new: (genData as any).scorecard,
        verdict: (genData as any).verdict,
        limitations: (genData as any).limitations,
        audit_result: genData as any,
        debug_trace: (genData as any).debug_trace,
        line_explanations: undefined,
        generated_prompt: undefined,
      };

      // ===== Update outputs =====
      const modeKey = mode as 'simple' | 'medium' | 'advanced';

      dispatch({
        type: 'SET_OUTPUTS',
        payload: {
          [modeKey]: {
            snippet: snippetData,
            fullAnalysis: genData,
            lineExplanations: [],
            generatedPrompt: '',
          },
        },
      });

      // ===== Build and set PromptInfo =====
      const promptInfo = buildPromptInfo(mode, genData);
      dispatch({
        type: 'SET_PROMPT_INFO',
        payload: promptInfo,
      });

      if (outputPanelRef.current) {
        outputPanelRef.current.setActiveTab('analysis');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Analysis failed. Please try again.';
      setErrorMessage(message);
      dispatch({ type: 'SET_ERROR', payload: message });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [code, language, mode, username, githubUsername, avatarUrl, dispatch, clearError]);

  // ===== Generate line-by-line explanation =====
  const handleExplain = useCallback(async () => {
    if (!code.trim()) {
      setErrorMessage('Please enter some code to explain.');
      return;
    }

    clearError();
    dispatch({ type: 'SET_EXPLAINING', payload: true });

    try {
      const explanations = await analysisService.explainLineByLine(code, language);
      const modeKey = mode as 'simple' | 'medium' | 'advanced';

      const currentOutput = outputs[modeKey] || { snippet: null, fullAnalysis: null, lineExplanations: [], generatedPrompt: '' };
      dispatch({
        type: 'SET_OUTPUTS',
        payload: {
          [modeKey]: {
            ...currentOutput,
            lineExplanations: explanations,
          },
        },
      });

      if (outputPanelRef.current) {
        outputPanelRef.current.setActiveTab('line-by-line');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Explanation failed. Please try again.';
      setErrorMessage(message);
      dispatch({ type: 'SET_EXPLAIN_ERROR', payload: message });
    } finally {
      dispatch({ type: 'SET_EXPLAINING', payload: false });
    }
  }, [code, language, mode, outputs, dispatch, clearError]);

  // ===== Generate prompt =====
  const handleGeneratePrompt = useCallback(async () => {
    if (!code.trim()) {
      setErrorMessage('Please enter some code to generate a prompt.');
      return;
    }

    clearError();
    dispatch({ type: 'SET_GENERATING_PROMPT', payload: true });

    try {
      const prompt = await analysisService.generatePrompt(code, language, mode);
      const modeKey = mode as 'simple' | 'medium' | 'advanced';

      const currentOutput = outputs[modeKey] || { snippet: null, fullAnalysis: null, lineExplanations: [], generatedPrompt: '' };
      dispatch({
        type: 'SET_OUTPUTS',
        payload: {
          [modeKey]: {
            ...currentOutput,
            generatedPrompt: prompt,
          },
        },
      });

      if (outputPanelRef.current) {
        outputPanelRef.current.setActiveTab('prompt');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Prompt generation failed. Please try again.';
      setErrorMessage(message);
      dispatch({ type: 'SET_PROMPT_ERROR', payload: message });
    } finally {
      dispatch({ type: 'SET_GENERATING_PROMPT', payload: false });
    }
  }, [code, language, mode, outputs, dispatch, clearError]);

  // ===== Convert code =====
  const handleConvert = useCallback(async (targetLang: string) => {
    if (!code.trim()) {
      setErrorMessage('Please enter some code to convert.');
      return;
    }

    clearError();
    dispatch({ type: 'SET_CONVERTING', payload: true });

    try {
      const convertedCode = await analysisService.convertCode(code, language, targetLang);
      dispatch({ type: 'SET_CODE', payload: convertedCode });
      dispatch({ type: 'SET_LANGUAGE', payload: targetLang });
      dispatch({ type: 'SET_CONVERT_ERROR', payload: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Conversion failed. Please try again.';
      dispatch({ type: 'SET_CONVERT_ERROR', payload: message });
    } finally {
      dispatch({ type: 'SET_CONVERTING', payload: false });
    }
  }, [code, language, dispatch, clearError]);

  // ===== Clear all =====
  const handleClear = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
    clearError();
  }, [dispatch, clearError]);

  // ===== Update username =====
  const handleUsernameChange = useCallback((name: string) => {
    dispatch({ type: 'SET_USERNAME', payload: name });
  }, [dispatch]);

  const handleGithubChange = useCallback((name: string) => {
    dispatch({ type: 'SET_GITHUB_USERNAME', payload: name });
  }, [dispatch]);

  // ===== Toast =====
  const showToast = useCallback((message: string) => {
    dispatch({ type: 'SET_TOAST', payload: message });
    setTimeout(() => dispatch({ type: 'SET_TOAST', payload: null }), 3000);
  }, [dispatch]);

  // ===== Keyboard shortcut: Ctrl+Enter =====
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleGenerate();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleGenerate]);

  return (
    <main className="min-h-screen bg-[#f8f9fa] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* ===== Header ===== */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-[#1a1a2e] flex items-center gap-2">
            <span className="text-[#4a86f7]">⚡</span> Zbloue
            <span className="text-sm font-normal text-[#6c7086] ml-2">AI Code Analysis</span>
          </h1>
          <p className="text-sm text-[#6c7086]">
            Paste your code, select a mode, and let AI analyze, explain, and improve it.
          </p>
        </div>

        {/* ===== Error Display ===== */}
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center justify-between">
            <span>❌ {errorMessage}</span>
            <button onClick={clearError} className="text-red-400 hover:text-red-600">
              ×
            </button>
          </div>
        )}

        {/* ===== Editor + Output ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[calc(100vh-180px)] min-h-[600px]">
          <div className="min-h-[400px] lg:min-h-0">
            <Editor
              onGenerate={handleGenerate}
              onConvert={handleConvert}
              onExplain={handleExplain}
              onClear={handleClear}
              onGeneratePrompt={handleGeneratePrompt}
            />
          </div>

          <div className="min-h-[400px] lg:min-h-0">
            <OutputPanel
              ref={outputPanelRef}
              onUsernameChange={handleUsernameChange}
              onGithubChange={handleGithubChange}
              showToast={showToast}
              onLineHover={(line) => dispatch({ type: 'SET_HOVERED_LINE', payload: line })}
            />
          </div>
        </div>

        {/* ===== Footer ===== */}
        <div className="mt-4 text-center text-xs text-[#a0a0b0] border-t border-[#d0d0d8] pt-3">
          Press <kbd className="px-1.5 py-0.5 bg-[#e8e8f0] rounded text-[#4a4a6a] text-xs font-mono">Ctrl+Enter</kbd> to generate
        </div>
      </div>
    </main>
  );
}