// app/page.tsx

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Editor from '@/components/Editor';
import OutputPanel from '@/components/OutputPanel/OutputPanel';
import { useAppContext } from '@/context';
import { analysisService } from '@/services/analysisService';
import { snippetService } from '@/services/snippetService';
import { type GenerateResponse, type Snippet } from '@/types';
import { 
  CodeWalkthroughItem,
  BugAndRiskyCase,
  EdgeCase,
  PerformanceAnalysis,
  SecurityAnalysis,
  ProductionReadiness,
  RecommendedImprovement,
} from '@/types';

// ============================================================
// 🔥 تابع تبدیل Legacy به Advanced
// ============================================================
function convertLegacyToAdvanced(genData: GenerateResponse): Partial<GenerateResponse> {
  const result: Partial<GenerateResponse> = { ...genData };

  if (genData.codeWalkthrough) {
    result.codeWalkthrough = genData.codeWalkthrough;
  }
  if (genData.whatWorksWell) {
    result.whatWorksWell = genData.whatWorksWell;
  }
  if (genData.bugsAndRiskyCases) {
    result.bugsAndRiskyCases = genData.bugsAndRiskyCases;
  }
  if (genData.edgeCases) {
    result.edgeCases = genData.edgeCases;
  }
  if (genData.performanceAnalysis) {
    result.performanceAnalysis = genData.performanceAnalysis;
  }
  if (genData.securityAnalysis) {
    result.securityAnalysis = genData.securityAnalysis;
  }
  if (genData.productionReadiness) {
    result.productionReadiness = genData.productionReadiness;
  }
  if (genData.recommendedImprovements) {
    result.recommendedImprovements = genData.recommendedImprovements;
  }

  return result;
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

      const genData = response as GenerateResponse;

      const card_title = genData.title ?? genData.card_title ?? 'Code Analysis';
      const key_concept = genData.highLevelSummary ?? genData.summary ?? 'No summary provided.';
      const what_this_code_does = genData.analysis ?? genData.what_this_code_does ?? '';
      const debug_analysis = genData.debug_analysis ?? '-';
      const optimization = genData.optimization ?? '-';
      const linkedin_post = genData.linkedin_post ?? '';

      // ===== ساخت شیء برای SaveSnippetData (با فیلد `code`) =====
      const saveData = {
        code: code, // 🔥 فیلد مورد نیاز برای SaveSnippetData
        language,
        card_title,
        key_concept,
        what_this_code_does,
        debug_analysis,
        optimization,
        linkedin_post,
        username: username || 'Developer',
        github_username: githubUsername ?? undefined,
        avatar_url: avatarUrl ?? undefined,
        // Legacy fields
        code_walkthrough: genData.codeWalkthrough ?? undefined,
        what_works_well: genData.whatWorksWell ?? undefined,
        bugs_and_risky_cases: genData.bugsAndRiskyCases ?? undefined,
        edge_cases: genData.edgeCases ?? undefined,
        performance_analysis: genData.performanceAnalysis ?? undefined,
        security_analysis: genData.securityAnalysis ?? undefined,
        production_readiness: genData.productionReadiness ?? undefined,
        recommended_improvements: genData.recommendedImprovements ?? undefined,
        improved_code: genData.improvedCode?.code ?? undefined,
        suggested_tests: genData.suggestedTestsLegacy ?? undefined,
        scorecard: genData.scorecardLegacy ?? undefined,
        final_verdict_summary: genData.finalVerdict?.summary ?? undefined,
        final_verdict_approved: genData.finalVerdict?.approved ?? undefined,
        final_verdict_next_steps: genData.finalVerdict?.nextSteps ?? undefined,
        // Advanced fields
        findings: genData.findings ?? undefined,
        execution_overview: genData.executionOverview ?? undefined,
        architectural_observations: genData.architecturalObservations ?? undefined,
        recommended_actions: genData.recommendedActions ?? undefined,
        suggested_tests_new: genData.suggestedTests ?? undefined,
        complexity: genData.complexity ?? undefined,
        scorecard_new: genData.scorecard ?? undefined,
        verdict: genData.verdict ?? undefined,
        limitations: genData.limitations ?? undefined,
        audit_result: genData,
        debug_trace: (genData as any).debug_trace ?? undefined,
      };

      // ===== ذخیره در دیتابیس =====
      const saveResult = await snippetService.save(saveData);

      // ===== ساخت Snippet کامل برای UI =====
      const snippetData: Snippet = {
        id: saveResult.id,
        slug: saveResult.slug,
        raw_code: code,
        language,
        card_title,
        key_concept,
        what_this_code_does,
        debug_analysis,
        optimization,
        linkedin_post,
        is_public: true,
        created_at: new Date().toISOString(),
        username: saveResult.username || username || 'Developer',
        github_username: saveResult.github_username ?? githubUsername ?? undefined,
        avatar_url: saveResult.avatar_url ?? avatarUrl ?? undefined,
        card_image_url: undefined,
        // Legacy fields
        code_walkthrough: genData.codeWalkthrough ?? undefined,
        what_works_well: genData.whatWorksWell ?? undefined,
        bugs_and_risky_cases: genData.bugsAndRiskyCases ?? undefined,
        edge_cases: genData.edgeCases ?? undefined,
        performance_analysis: genData.performanceAnalysis ?? undefined,
        security_analysis: genData.securityAnalysis ?? undefined,
        production_readiness: genData.productionReadiness ?? undefined,
        recommended_improvements: genData.recommendedImprovements ?? undefined,
        improved_code: genData.improvedCode?.code ?? undefined,
        suggested_tests: genData.suggestedTestsLegacy ?? undefined,
        scorecard: genData.scorecardLegacy ?? undefined,
        final_verdict_summary: genData.finalVerdict?.summary ?? undefined,
        final_verdict_approved: genData.finalVerdict?.approved ?? undefined,
        final_verdict_next_steps: genData.finalVerdict?.nextSteps ?? undefined,
        // Advanced fields
        findings: genData.findings ?? undefined,
        execution_overview: genData.executionOverview ?? undefined,
        architectural_observations: genData.architecturalObservations ?? undefined,
        recommended_actions: genData.recommendedActions ?? undefined,
        suggested_tests_new: genData.suggestedTests ?? undefined,
        complexity: genData.complexity ?? undefined,
        scorecard_new: genData.scorecard ?? undefined,
        verdict: genData.verdict ?? undefined,
        limitations: genData.limitations ?? undefined,
        audit_result: genData,
        debug_trace: (genData as any).debug_trace ?? undefined,
      };

      // ===== به‌روزرسانی Outputs =====
      const fullAnalysis = convertLegacyToAdvanced(genData);
      const modeKey = mode as 'simple' | 'medium' | 'advanced';

      dispatch({
        type: 'SET_OUTPUT',
        payload: {
          mode: modeKey,
          snippet: snippetData,
          fullAnalysis,
          lineExplanations: [],
          generatedPrompt: '',
        },
      });

      const auditType = genData.auditType ?? null;
      const status = genData.status ?? null;
      dispatch({
        type: 'SET_PROMPT_INFO',
        payload: {
          auditType: auditType === 'concurrency' ? 'concurrency' : 'generic',
          status: status as any,
          isPipeline: true,
        },
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

      dispatch({
        type: 'SET_LINE_EXPLANATIONS',
        payload: {
          mode: modeKey,
          explanations,
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
  }, [code, language, mode, dispatch, clearError]);

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

      dispatch({
        type: 'SET_GENERATED_PROMPT',
        payload: {
          mode: modeKey,
          prompt,
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
  }, [code, language, mode, dispatch, clearError]);

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

  // ===== Keyboard shortcut =====
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
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-[#1a1a2e] flex items-center gap-2">
            <span className="text-[#4a86f7]">⚡</span> Zbloue
            <span className="text-sm font-normal text-[#6c7086] ml-2">AI Code Analysis</span>
          </h1>
          <p className="text-sm text-[#6c7086]">
            Paste your code, select a mode, and let AI analyze, explain, and improve it.
          </p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center justify-between">
            <span>❌ {errorMessage}</span>
            <button onClick={clearError} className="text-red-400 hover:text-red-600">
              ×
            </button>
          </div>
        )}

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

        <div className="mt-4 text-center text-xs text-[#a0a0b0] border-t border-[#d0d0d8] pt-3">
          Press <kbd className="px-1.5 py-0.5 bg-[#e8e8f0] rounded text-[#4a4a6a] text-xs font-mono">Ctrl+Enter</kbd> to generate
        </div>
      </div>
    </main>
  );
}