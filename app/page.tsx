// app/page.tsx

'use client';

import { useRef, useEffect, useCallback, useMemo } from 'react';
import Editor from '@/components/Editor';
import OutputPanel from '@/components/OutputPanel';
import { HomeHeader, ErrorDisplay, HomeFooter } from '@/components/home';
import { AppProvider, useAppContext } from '@/context';
import { snippetService, analysisService, type SaveSnippetData } from '@/services';
import { detectLanguage } from '@/lib/languageDetector';
import { isCodeLike, removeComments } from '@/lib/utils';
import {
  MAX_LINES_GENERATE,
  MAX_LINES_EXPLAIN,
  MAX_LINES_PROMPT,
  MAX_CODE_LENGTH,
} from '@/lib/constants';
import {
  Snippet,
  GenerateResponse,
  PromptInfo,
  LineExplanation,
  AdvancedAuditResult,
  AuditFinding,
  AuditScorecard,
  CodeWalkthroughItem,
  BugAndRiskyCase,
  EdgeCase,
  PerformanceAnalysis,
  SecurityAnalysis,
  ProductionReadiness,
  RecommendedImprovement,
  SuggestedTest,
  ScorecardLegacy,
} from '@/types';
import logger from '@/lib/logger';

const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL || 'https://github.com/sadat006363/Zbloue';

const MODE_DESCRIPTIONS: Record<'simple' | 'medium' | 'advanced', string> = {
  simple: '⚡ Quick analysis for basic code review — fast and concise. Identifies obvious syntax errors and logic flaws.',
  medium: '📊 Balanced analysis with more details. Identifies functional bugs, edge cases (null, undefined, empty inputs), and provides actionable suggestions.',
  advanced: '🔬 Deep production-grade analysis. Includes security review, performance analysis (Big O), edge cases, improved code, test suggestions, and a scorecard.'
};

const removeEmptyLines = (text: string): string => {
  return text.split('\n').filter(line => line.trim() !== '').join('\n');
};

function HomeContent() {
  const { state, dispatch } = useAppContext();
  const {
    code, language, mode, loading, isConverting, isExplaining, isGeneratingPrompt,
    errorMessage, convertError, explainError, promptError, outputs,
    username, githubUsername, avatarUrl, convertLanguage, hoveredLine, toastMessage,
    promptInfo,
  } = state;

  const abortControllerRef = useRef<AbortController | null>(null);
  const outputPanelRef = useRef<{ setActiveTab: (tab: string) => void } | null>(null);
  const loadingStartTimeRef = useRef<number | null>(null);
  const isProcessingRef = useRef(false);
  const MIN_LOADING_MS = 400;

  // ============================================================
  // 🔍 لاگ‌گذاری نوع پرامپت در کنسول مرورگر
  // ============================================================
  useEffect(() => {
    if (promptInfo) {
      const { auditType, status, isPipeline } = promptInfo;

      let filePath = '';
      let promptName = '';

      if (isPipeline) {
        if (auditType === 'concurrency') {
          filePath = 'lib/analysis/prompts/concurrency.ts';
          promptName = 'CONCURRENCY (Pipeline)';
        } else if (auditType === 'generic') {
          filePath = 'lib/analysis/prompts/generic.ts';
          promptName = 'GENERIC (Pipeline)';
        } else {
          filePath = 'lib/analysis/prompts/* (unknown)';
          promptName = `${auditType?.toUpperCase() || 'UNKNOWN'} (Pipeline)`;
        }
      } else {
        if (auditType === 'simple') {
          filePath = 'lib/ai.ts (SIMPLE_PROMPT)';
          promptName = 'SIMPLE (Legacy)';
        } else if (auditType === 'medium') {
          filePath = 'lib/ai.ts (MEDIUM_PROMPT)';
          promptName = 'MEDIUM (Legacy)';
        } else if (auditType === 'advanced') {
          filePath = 'lib/ai.ts (ADVANCED_PROMPT - Fallback)';
          promptName = 'ADVANCED (Legacy Fallback)';
        } else {
          filePath = 'lib/ai.ts (unknown)';
          promptName = `${auditType?.toUpperCase() || 'UNKNOWN'} (Legacy)`;
        }
      }

      console.log(
        `%c🔍 [Zbloue] Prompt Execution Report`,
        'font-size:14px; font-weight:bold; color:#4a86f7;'
      );
      console.log(`   📄 File: ${filePath}`);
      console.log(`   📝 Type: ${promptName}`);
      console.log(`   📊 Status: ${status?.toUpperCase() || 'UNKNOWN'}`);
      console.log(`   🏷️  Mode: ${mode.toUpperCase()}`);

      if (process.env.NODE_ENV === 'development') {
        console.log('   📋 Full promptInfo:', promptInfo);
      }

      console.log(
        `%c${'─'.repeat(60)}`,
        'color:#6c7086;'
      );
    }
  }, [promptInfo, mode]);

  const showToast = useCallback((message: string) => {
    dispatch({ type: 'SET_TOAST', payload: message });
    setTimeout(() => dispatch({ type: 'SET_TOAST', payload: null }), 3000);
  }, [dispatch]);

  const handleClearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    showToast('🧹 All content cleared!');
  }, [dispatch, showToast]);

  const handleModeChange = useCallback((newMode: 'simple' | 'medium' | 'advanced') => {
    dispatch({ type: 'SET_MODE', payload: newMode });
    dispatch({ type: 'SET_ERROR', payload: null });
  }, [dispatch]);

  const handleUsernameChange = useCallback((newUsername: string) => {
    dispatch({ type: 'SET_USERNAME', payload: newUsername });
  }, [dispatch]);

  const handleGithubChange = useCallback((newGithub: string) => {
    dispatch({ type: 'SET_GITHUB_USERNAME', payload: newGithub });
  }, [dispatch]);

  const handleAvatarChange = useCallback((newAvatar: string | null) => {
    dispatch({ type: 'SET_AVATAR', payload: newAvatar });
  }, [dispatch]);

  const handleSnippetUpdate = useCallback((data: { username: string; github_username: string }) => {
    const currentSnippet = outputs[mode].snippet;
    if (currentSnippet) {
      dispatch({
        type: 'SET_OUTPUTS',
        payload: {
          [mode]: {
            snippet: {
              ...currentSnippet,
              username: data.username,
              github_username: data.github_username,
            },
          },
        },
      });
    }
  }, [mode, outputs, dispatch]);

  useEffect(() => {
    if (code.trim().length > 0) {
      const detected = detectLanguage(code);
      if (detected.confidence !== 'low' && detected.language !== language) {
        dispatch({ type: 'SET_LANGUAGE', payload: detected.language });
      }
    }
  }, [code, language, dispatch]);

  useEffect(() => {
    if (code.trim().length > 0 || language) {
      if (!isProcessingRef.current) {
        dispatch({ type: 'CLEAR_CURRENT_OUTPUT' });
      }
    }
  }, [code, language, dispatch]);

  const currentOutput = useMemo(() => outputs[mode], [outputs, mode]);
  const displaySnippet = useMemo(() => currentOutput.snippet, [currentOutput]);
  const displayFullAnalysis = useMemo(() => currentOutput.fullAnalysis, [currentOutput]);
  const displayLineExplanations = useMemo(() => currentOutput.lineExplanations, [currentOutput]);
  const displayGeneratedPrompt = useMemo(() => currentOutput.generatedPrompt, [currentOutput]);
  const modeDescription = useMemo(() => MODE_DESCRIPTIONS[mode], [mode]);

  const processCode = useCallback((rawCode: string, lang: string): string => {
    let processed = removeComments(rawCode, lang);
    processed = removeEmptyLines(processed);
    return processed;
  }, []);

  const validateCode = useCallback((processedCode: string): string | null => {
    if (!processedCode.trim()) return 'Please enter your code.';
    if (!isCodeLike(processedCode)) {
      return '⚠️ The input does not appear to be valid source code. Please paste your code and try again.';
    }
    const lines = processedCode.split('\n').length;
    if (lines > MAX_LINES_GENERATE) {
      return `Code exceeds ${MAX_LINES_GENERATE} lines (${lines} lines). Please shorten your code.`;
    }
    if (processedCode.length > MAX_CODE_LENGTH) {
      return `Code is too long (${processedCode.length} characters). Maximum is ${MAX_CODE_LENGTH} characters.`;
    }
    return null;
  }, []);

  const buildSnippetFromPayload = useCallback((
    saveResult: { id: string; slug: string; avatar_url?: string | null },
    processedCode: string,
    lang: string,
    payload: Record<string, unknown>
  ): Snippet => {
    return {
      id: saveResult.id,
      slug: saveResult.slug,
      raw_code: processedCode,
      language: lang,
      card_title: (payload.card_title as string) || 'Code Analysis',
      key_concept: (payload.key_concept as string) || '',
      what_this_code_does: (payload.what_this_code_does as string) || '',
      debug_analysis: (payload.debug_analysis as string) || '-',
      optimization: (payload.optimization as string) || '-',
      linkedin_post: (payload.linkedin_post as string) || '',
      is_public: true,
      created_at: new Date().toISOString(),
      username: username || 'Developer',
      github_username: githubUsername || null,
      avatar_url: saveResult.avatar_url || null,
      card_image_url: null,

      code_walkthrough: (payload.code_walkthrough as CodeWalkthroughItem[]) || undefined,
      what_works_well: (payload.what_works_well as string[]) || undefined,
      bugs_and_risky_cases: (payload.bugs_and_risky_cases as BugAndRiskyCase[]) || undefined,
      edge_cases: (payload.edge_cases as EdgeCase[]) || undefined,
      performance_analysis: (payload.performance_analysis as PerformanceAnalysis) || undefined,
      security_analysis: (payload.security_analysis as SecurityAnalysis) || undefined,
      production_readiness: (payload.production_readiness as ProductionReadiness) || undefined,
      recommended_improvements: (payload.recommended_improvements as RecommendedImprovement[]) || undefined,
      improved_code: (payload.improved_code as string) || undefined,
      suggested_tests: (payload.suggested_tests as SuggestedTest[]) || undefined,
      scorecard: (payload.scorecard as ScorecardLegacy) || undefined,
      final_verdict_summary: (payload.final_verdict_summary as string) || undefined,
      final_verdict_approved: (payload.final_verdict_approved as boolean) || undefined,
      final_verdict_next_steps: (payload.final_verdict_next_steps as string) || undefined,

      line_explanations: null,
      generated_prompt: null,

      findings: (payload.findings as AuditFinding[]) || undefined,
      execution_overview: (payload.execution_overview as AdvancedAuditResult['executionOverview']) || undefined,
      architectural_observations: (payload.architectural_observations as AdvancedAuditResult['architecturalObservations']) || undefined,
      recommended_actions: (payload.recommended_actions as AdvancedAuditResult['recommendedActions']) || undefined,
      suggested_tests_new: (payload.suggested_tests_new as AdvancedAuditResult['suggestedTests']) || undefined,
      complexity: (payload.complexity as AdvancedAuditResult['complexity']) || undefined,
      scorecard_new: (payload.scorecard_new as AuditScorecard) || undefined,
      verdict: (payload.verdict as AdvancedAuditResult['verdict']) || undefined,
      limitations: (payload.limitations as string[]) || undefined,
      // debug_trace: (payload.debug_trace as DebugTrace) || undefined, // ❌ حذف شده
    };
  }, [username, githubUsername]);

  const prepareSaveData = useCallback((
    processedCode: string,
    lang: string,
    genData: GenerateResponse
  ): SaveSnippetData => {
    const linkedin_post = genData.linkedin_post || 'Check out this code analysis! #Zbloue';

    // ❌ debug_trace حذف شده است

    if (mode === 'advanced') {
      const card_title = genData.title ?? genData.card_title ?? 'Code Analysis';
      const key_concept = genData.highLevelSummary ?? genData.summary ?? 'No summary provided.';

      let what_this_code_does = '';
      if (genData.codeWalkthrough && genData.codeWalkthrough.length > 0) {
        what_this_code_does = genData.codeWalkthrough.map((item) => item.explanation).join(' ');
      } else if (genData.summary) {
        what_this_code_does = genData.summary;
      } else {
        what_this_code_does = 'No description available.';
      }

      let debug_analysis = '';
      if (genData.findings && genData.findings.length > 0) {
        debug_analysis = genData.findings
          .map((f) => `[${f.severity}] ${f.title}: ${f.consequence}`)
          .join('; ');
      } else {
        debug_analysis = 'No bugs identified.';
      }

      let optimization = '';
      if (genData.recommendedActions && genData.recommendedActions.length > 0) {
        optimization = genData.recommendedActions
          .sort((a, b) => a.priority - b.priority)
          .map((a) => `${a.title}: ${a.action}`)
          .join('; ');
      } else {
        optimization = 'No improvements suggested.';
      }

      const baseData = {
        code: processedCode,
        language: lang,
        card_title,
        key_concept,
        what_this_code_does,
        debug_analysis,
        optimization,
        linkedin_post,
        username: username || 'Developer',
        github_username: githubUsername || null,
        avatar_url: avatarUrl,

        code_walkthrough: genData.codeWalkthrough || null,
        what_works_well: genData.whatWorksWell || null,
        bugs_and_risky_cases: genData.bugsAndRiskyCases || null,
        edge_cases: genData.edgeCases || null,
        performance_analysis: genData.performanceAnalysis || null,
        security_analysis: genData.securityAnalysis || null,
        production_readiness: genData.productionReadiness || null,
        recommended_improvements: genData.recommendedImprovements || null,
        improved_code: genData.improvedCode?.code || null,
        suggested_tests: genData.suggestedTestsLegacy || null,
        scorecard: genData.scorecardLegacy || null,
        final_verdict_summary: genData.finalVerdict?.summary || null,
        final_verdict_approved: genData.finalVerdict?.approved || null,
        final_verdict_next_steps: genData.finalVerdict?.nextSteps || null,

        findings: genData.findings || null,
        execution_overview: genData.executionOverview || null,
        architectural_observations: genData.architecturalObservations || null,
        recommended_actions: genData.recommendedActions || null,
        suggested_tests_new: genData.suggestedTests || null,
        complexity: genData.complexity || null,
        scorecard_new: genData.scorecard || null,
        verdict: genData.verdict || null,
        limitations: genData.limitations || null,
      };

      // ❌ debug_trace حذف شده است
      return baseData;

    } else {
      const analysisText = genData.analysis || 'No analysis generated.';
      const summaryLines = analysisText.split('\n').slice(0, 4).join('\n');
      const card_title = mode === 'simple' ? 'Quick Analysis' : 'Standard Analysis';

      return {
        code: processedCode,
        language: lang,
        card_title,
        key_concept: summaryLines,
        what_this_code_does: analysisText,
        debug_analysis: '-',
        optimization: '-',
        linkedin_post,
        username: username || 'Developer',
        github_username: githubUsername || null,
        avatar_url: avatarUrl,
        // debug_trace: debugTrace || null, // ❌ حذف شده
      };
    }
  }, [mode, username, githubUsername, avatarUrl]);

  const handleGenerate = useCallback(async () => {
    loadingStartTimeRef.current = Date.now();
    isProcessingRef.current = true;
    dispatch({ type: 'SET_LOADING', payload: true });

    const processedCode = processCode(code, language);
    if (processedCode !== code) {
      dispatch({ type: 'SET_CODE', payload: processedCode });
    }

    const validationError = validateCode(processedCode);
    if (validationError) {
      dispatch({ type: 'SET_ERROR', payload: validationError });
      dispatch({ type: 'SET_LOADING', payload: false });
      loadingStartTimeRef.current = null;
      isProcessingRef.current = false;
      return;
    }

    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      const genData = await analysisService.generate({
        code: processedCode,
        language,
        mode,
        signal: abortControllerRef.current.signal,
      });

      const saveDataPayload = prepareSaveData(processedCode, language, genData);
      const saveResult = await snippetService.save(saveDataPayload);
      const newSnippet = buildSnippetFromPayload(saveResult, processedCode, language, saveDataPayload);

      const fullAnalysisData: GenerateResponse | null = mode === 'advanced'
        ? genData
        : { analysis: genData.analysis, linkedin_post: genData.linkedin_post };

      const isPipeline = !!genData.schemaVersion;
      let auditType: PromptInfo['auditType'] = mode;
      let status: PromptInfo['status'] = 'complete';

      if (isPipeline) {
        auditType = genData.auditType || 'advanced';
        status = genData.status || 'complete';
      } else if (mode === 'advanced') {
        status = 'fallback';
      }

      dispatch({
        type: 'SET_PROMPT_INFO',
        payload: {
          auditType,
          status,
          isPipeline,
        },
      });

      dispatch({
        type: 'SET_OUTPUTS',
        payload: {
          [mode]: {
            snippet: newSnippet,
            fullAnalysis: fullAnalysisData,
            lineExplanations: currentOutput.lineExplanations || [],
            generatedPrompt: currentOutput.generatedPrompt || '',
          },
        },
      });

      if (outputPanelRef.current) {
        outputPanelRef.current.setActiveTab('explanation');
      }
      showToast('✅ Code analyzed successfully!');
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        dispatch({ type: 'SET_ERROR', payload: null });
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error occurred.';
      if (process.env.NODE_ENV === 'development') {
        logger.error('[Home] Generate error:', error);
      }
      dispatch({ type: 'SET_ERROR', payload: message });
      dispatch({ type: 'SET_PROMPT_INFO', payload: null });
    } finally {
      const elapsed = Date.now() - (loadingStartTimeRef.current || Date.now());
      const remaining = Math.max(0, MIN_LOADING_MS - elapsed);
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining));
      }
      dispatch({ type: 'SET_LOADING', payload: false });
      loadingStartTimeRef.current = null;
      isProcessingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [code, language, mode, currentOutput, dispatch, processCode, validateCode, prepareSaveData, buildSnippetFromPayload, showToast]);

  const copyPromptInfo = useCallback(() => {
    if (!promptInfo) return;

    const text = `Prompt: ${promptInfo.auditType?.toUpperCase()} | Status: ${promptInfo.status?.toUpperCase()} | ${promptInfo.isPipeline ? 'Pipeline' : promptInfo.auditType === 'advanced' ? 'Fallback' : 'Legacy'}`;

    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 Prompt status copied to clipboard!');
    }).catch(() => {
      showToast('❌ Failed to copy status');
    });
  }, [promptInfo, showToast]);

  const handleGenerateExplanation = useCallback(async () => {
    const trimmedCode = removeEmptyLines(code);
    if (!trimmedCode.trim()) {
      showToast('❌ Please enter some code first.');
      return;
    }
    if (trimmedCode !== code) dispatch({ type: 'SET_CODE', payload: trimmedCode });

    const lines = trimmedCode.split('\n').filter((line: string) => line.trim().length > 0);
    if (lines.length > MAX_LINES_EXPLAIN) {
      const msg = `Code exceeds ${MAX_LINES_EXPLAIN} lines. Please shorten your code.`;
      dispatch({ type: 'SET_EXPLAIN_ERROR', payload: msg });
      showToast(`❌ ${msg}`);
      return;
    }

    isProcessingRef.current = true;
    dispatch({ type: 'SET_EXPLAIN_ERROR', payload: null });
    dispatch({ type: 'SET_EXPLAINING', payload: true });

    try {
      const explanations = await analysisService.explainLineByLine(trimmedCode, language);

      dispatch({
        type: 'SET_OUTPUTS',
        payload: {
          [mode]: { lineExplanations: explanations },
        },
      });
      if (displaySnippet?.slug) {
        await snippetService.update(displaySnippet.slug, { line_explanations: explanations });
      }
      showToast(`✅ ${explanations.length || 0} line explanations generated!`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to generate explanations';
      if (process.env.NODE_ENV === 'development') {
        logger.error('[Home] Explanation error:', error);
      }
      dispatch({ type: 'SET_EXPLAIN_ERROR', payload: message });
      showToast(`❌ ${message}`);
    } finally {
      dispatch({ type: 'SET_EXPLAINING', payload: false });
      isProcessingRef.current = false;
    }
  }, [code, language, mode, displaySnippet, dispatch, showToast]);

  const handleGeneratePrompt = useCallback(async () => {
    const trimmedCode = removeEmptyLines(code);
    if (!trimmedCode.trim()) {
      showToast('❌ Please enter some code first.');
      return;
    }
    if (trimmedCode !== code) dispatch({ type: 'SET_CODE', payload: trimmedCode });

    const lines = trimmedCode.split('\n').filter((line: string) => line.trim().length > 0);
    if (lines.length > MAX_LINES_PROMPT) {
      const msg = `Code exceeds ${MAX_LINES_PROMPT} lines. Please shorten your code.`;
      dispatch({ type: 'SET_PROMPT_ERROR', payload: msg });
      showToast(`❌ ${msg}`);
      return;
    }

    isProcessingRef.current = true;
    dispatch({ type: 'SET_PROMPT_ERROR', payload: null });
    dispatch({ type: 'SET_GENERATING_PROMPT', payload: true });

    try {
      const prompt = await analysisService.generatePrompt(trimmedCode, language, mode);

      dispatch({
        type: 'SET_OUTPUTS',
        payload: {
          [mode]: { generatedPrompt: prompt },
        },
      });
      if (displaySnippet?.slug) {
        await snippetService.update(displaySnippet.slug, { generated_prompt: prompt });
      }
      showToast('✅ Prompt generated! Check the Prompt tab.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to generate prompt';
      if (process.env.NODE_ENV === 'development') {
        logger.error('[Home] Prompt generation error:', error);
      }
      dispatch({ type: 'SET_PROMPT_ERROR', payload: message });
      showToast(`❌ ${message}`);
    } finally {
      dispatch({ type: 'SET_GENERATING_PROMPT', payload: false });
      isProcessingRef.current = false;
    }
  }, [code, language, mode, displaySnippet, dispatch, showToast]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      dispatch({ type: 'SET_LOADING', payload: false });
      isProcessingRef.current = false;
      showToast('⏹️ Generation stopped by user');
    }
  }, [dispatch, showToast]);

  const handleConvertCode = useCallback(async (targetLang: string) => {
    const trimmedCode = removeEmptyLines(code);
    if (!trimmedCode.trim()) {
      dispatch({ type: 'SET_CONVERT_ERROR', payload: 'Please enter some code first.' });
      showToast('❌ Please enter some code first.');
      return;
    }
    if (targetLang === language) {
      dispatch({ type: 'SET_CONVERT_ERROR', payload: 'Target language is the same as source language.' });
      showToast('❌ Target language is the same as source language.');
      return;
    }
    if (['html', 'css', 'json'].includes(language)) {
      const msg = `Converting ${language} to other languages is not supported.`;
      dispatch({ type: 'SET_CONVERT_ERROR', payload: msg });
      showToast(`❌ ${msg}`);
      return;
    }

    isProcessingRef.current = true;
    dispatch({ type: 'SET_CONVERT_ERROR', payload: null });
    dispatch({ type: 'SET_CONVERTING', payload: true });

    try {
      const convertedCode = await analysisService.convertCode(trimmedCode, language, targetLang);
      const cleanedCode = removeEmptyLines(convertedCode);

      dispatch({ type: 'SET_CODE', payload: cleanedCode });
      dispatch({ type: 'SET_LANGUAGE', payload: targetLang });
      dispatch({ type: 'SET_CONVERT_LANGUAGE', payload: '' });
      showToast(`✅ Code converted to ${targetLang.toUpperCase()} successfully!`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to convert code';
      if (process.env.NODE_ENV === 'development') {
        logger.error('[Home] Conversion error:', error);
      }
      dispatch({ type: 'SET_CONVERT_ERROR', payload: message });
      showToast(`❌ ${message}`);
    } finally {
      dispatch({ type: 'SET_CONVERTING', payload: false });
      isProcessingRef.current = false;
    }
  }, [code, language, dispatch, showToast]);

  return (
    <div className="flex-1 max-w-7xl mx-auto w-full">
      {toastMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-[#1a1a2e] text-white px-6 py-3 rounded-lg shadow-lg z-50 text-sm transition-all duration-300">
          {toastMessage}
        </div>
      )}

      <HomeHeader githubUrl={GITHUB_URL} />

      <div className="mb-4 flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl border-2 border-[#d0d0d8] shadow-sm">
        <span className="text-sm font-medium text-[#1a1a2e] whitespace-nowrap">Analysis Mode:</span>
        <div className="flex gap-2">
          {(['simple', 'medium', 'advanced'] as const).map((m) => (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={`px-4 py-1.5 text-sm rounded-full border-2 transition ${
                mode === m
                  ? 'bg-[#4a86f7] text-white border-[#4a86f7]'
                  : 'bg-white text-[#4a4a6a] border-[#d0d0d8] hover:border-[#4a86f7]'
              }`}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[200px] text-sm text-[#4a86f7] font-medium leading-relaxed border-l-2 border-[#d0d0d8] pl-3 ml-1">
          {modeDescription}
        </div>
      </div>

      <ErrorDisplay message={errorMessage} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8" style={{ minHeight: 'calc(100vh - 200px)' }}>
        <Editor
          onGenerate={handleGenerate}
          onConvert={handleConvertCode}
          onExplain={handleGenerateExplanation}
          onClear={handleClearAll}
          onGeneratePrompt={handleGeneratePrompt}
          onStop={handleStop}
        />

        <div className="flex flex-col h-full">
          {promptInfo && (
            <div className="mb-3 px-4 py-2.5 bg-[#3a3a6e] rounded-lg text-xs flex flex-wrap items-center gap-3 border border-[#5a5a8e] shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-[#8a8aaa]">📋</span>
                <span className="text-[#a6adc8] font-medium">Prompt:</span>
                <span className="text-[#89b4fa] font-mono font-semibold text-sm">
                  {promptInfo.auditType?.toUpperCase()}
                </span>
              </div>

              <span className="text-[#5a5a8e]">|</span>

              <div className="flex items-center gap-2">
                <span className="text-[#a6adc8]">Status:</span>
                <div className="flex items-center gap-1.5">
                  <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                    promptInfo.status === 'complete' ? 'bg-[#a6e3a1] shadow-[0_0_8px_#a6e3a1]' :
                    promptInfo.status === 'repaired' ? 'bg-[#f9e2af] shadow-[0_0_8px_#f9e2af]' :
                    promptInfo.status === 'fallback' ? 'bg-[#f38ba8] shadow-[0_0_8px_#f38ba8]' :
                    promptInfo.status === 'partially_complete' ? 'bg-[#fab387] shadow-[0_0_8px_#fab387]' :
                    'bg-[#f38ba8] shadow-[0_0_8px_#f38ba8]'
                  }`} />
                  <span className={`font-medium ${
                    promptInfo.status === 'complete' ? 'text-[#a6e3a1]' :
                    promptInfo.status === 'repaired' ? 'text-[#f9e2af]' :
                    promptInfo.status === 'fallback' ? 'text-[#f38ba8]' :
                    promptInfo.status === 'partially_complete' ? 'text-[#fab387]' :
                    'text-[#f38ba8]'
                  }`}>
                    {promptInfo.status?.toUpperCase()}
                  </span>
                </div>
              </div>

              <span className="text-[#5a5a8e]">|</span>

              <div className="flex items-center gap-2">
                {promptInfo.isPipeline && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#4a86f7]/20 border border-[#4a86f7]/30">
                    <span className="inline-block w-2 h-2 rounded-full bg-[#4a86f7] shadow-[0_0_6px_#4a86f7]" />
                    <span className="text-[#89b4fa] text-[10px] font-medium">Pipeline</span>
                  </div>
                )}
                {!promptInfo.isPipeline && promptInfo.auditType === 'advanced' && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#f38ba8]/20 border border-[#f38ba8]/30">
                    <span className="inline-block w-2 h-2 rounded-full bg-[#f38ba8] shadow-[0_0_6px_#f38ba8]" />
                    <span className="text-[#f38ba8] text-[10px] font-medium">Fallback</span>
                  </div>
                )}
                {!promptInfo.isPipeline && promptInfo.auditType !== 'advanced' && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#6c7086]/20 border border-[#6c7086]/30">
                    <span className="inline-block w-2 h-2 rounded-full bg-[#6c7086]" />
                    <span className="text-[#a6adc8] text-[10px] font-medium">Legacy</span>
                  </div>
                )}
              </div>

              <button
                onClick={copyPromptInfo}
                className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#4a4a7e] hover:bg-[#5a5a9e] transition-colors border border-[#5a5a8e] text-[#a6adc8] hover:text-white"
                title="Copy prompt status to clipboard"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                </svg>
                <span className="text-[10px] font-medium">Copy</span>
              </button>

              <div className="text-[10px] text-[#6c7086] hidden sm:block">
                {promptInfo.isPipeline ? '⚡ Advanced Pipeline' : '📝 Legacy Mode'}
              </div>
            </div>
          )}

          <OutputPanel
            ref={outputPanelRef}
            onUsernameChange={handleUsernameChange}
            onGithubChange={handleGithubChange}
            onSnippetUpdate={handleSnippetUpdate}
            onGenerateExplanation={handleGenerateExplanation}
            onLineHover={(line) => dispatch({ type: 'SET_HOVERED_LINE', payload: line })}
            onAvatarChange={handleAvatarChange}
            showToast={showToast}
          />
        </div>
      </div>

      <HomeFooter />
    </div>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <HomeContent />
    </AppProvider>
  );
}