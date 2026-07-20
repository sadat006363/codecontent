// app/page.tsx

'use client';

import { useState, useEffect, useCallback, useRef, useMemo, useReducer } from 'react';
import Editor from '@/components/Editor';
import OutputPanel from '@/components/OutputPanel';
import { Snippet, GenerateResponse } from '@/types';
import { detectLanguage } from '@/lib/languageDetector';
import { isCodeLike, removeComments } from '@/lib/utils';
import {
  MAX_LINES_GENERATE,
  MAX_LINES_EXPLAIN,
  MAX_LINES_PROMPT,
  MAX_CODE_LENGTH,
} from '@/lib/constants';
import { HomeHeader, ErrorDisplay, HomeFooter } from '@/components/home';

const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL || 'https://github.com/sadat006363/Zbloue';

const MODE_DESCRIPTIONS = {
  simple: '⚡ Quick analysis for basic code review — fast and concise. Identifies obvious syntax errors and logic flaws.',
  medium: '📊 Balanced analysis with more details. Identifies functional bugs, edge cases (null, undefined, empty inputs), and provides actionable suggestions.',
  advanced: '🔬 Deep production-grade analysis. Includes security review, performance analysis (Big O), edge cases, improved code, test suggestions, and a scorecard.'
};

const removeEmptyLines = (text: string): string => {
  return text.split('\n').filter(line => line.trim() !== '').join('\n');
};

type OutputsByMode = {
  [K in 'simple' | 'medium' | 'advanced']: {
    snippet: Snippet | null;
    fullAnalysis: GenerateResponse | null;
    lineExplanations: any[];
    generatedPrompt: string;
  };
};

type AppState = {
  code: string;
  language: string;
  mode: 'simple' | 'medium' | 'advanced';
  loading: boolean;
  isConverting: boolean;
  isExplaining: boolean;
  isGeneratingPrompt: boolean;
  errorMessage: string | null;
  convertError: string | null;
  explainError: string | null;
  promptError: string | null;
  outputs: OutputsByMode;
  username: string;
  githubUsername: string;
  avatarUrl: string | null;
  convertLanguage: string;
  hoveredLine: number | null;
  toastMessage: string | null;
};

type Action =
  | { type: 'SET_CODE'; payload: string }
  | { type: 'SET_LANGUAGE'; payload: string }
  | { type: 'SET_MODE'; payload: 'simple' | 'medium' | 'advanced' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CONVERTING'; payload: boolean }
  | { type: 'SET_EXPLAINING'; payload: boolean }
  | { type: 'SET_GENERATING_PROMPT'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_CONVERT_ERROR'; payload: string | null }
  | { type: 'SET_EXPLAIN_ERROR'; payload: string | null }
  | { type: 'SET_PROMPT_ERROR'; payload: string | null }
  | { type: 'SET_OUTPUTS'; payload: Partial<OutputsByMode> }
  | { type: 'SET_USERNAME'; payload: string }
  | { type: 'SET_GITHUB_USERNAME'; payload: string }
  | { type: 'SET_AVATAR'; payload: string | null }
  | { type: 'SET_CONVERT_LANGUAGE'; payload: string }
  | { type: 'SET_HOVERED_LINE'; payload: number | null }
  | { type: 'SET_TOAST'; payload: string | null }
  | { type: 'CLEAR_ALL' }
  | { type: 'CLEAR_CURRENT_OUTPUT' };

const initialState: AppState = {
  code: '',
  language: 'javascript',
  mode: 'simple',
  loading: false,
  isConverting: false,
  isExplaining: false,
  isGeneratingPrompt: false,
  errorMessage: null,
  convertError: null,
  explainError: null,
  promptError: null,
  outputs: {
    simple: { snippet: null, fullAnalysis: null, lineExplanations: [], generatedPrompt: '' },
    medium: { snippet: null, fullAnalysis: null, lineExplanations: [], generatedPrompt: '' },
    advanced: { snippet: null, fullAnalysis: null, lineExplanations: [], generatedPrompt: '' },
  },
  username: 'Developer',
  githubUsername: '',
  avatarUrl: null,
  convertLanguage: '',
  hoveredLine: null,
  toastMessage: null,
};

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_CODE': return { ...state, code: action.payload };
    case 'SET_LANGUAGE': return { ...state, language: action.payload };
    case 'SET_MODE': return { ...state, mode: action.payload };
    case 'SET_LOADING': return { ...state, loading: action.payload };
    case 'SET_CONVERTING': return { ...state, isConverting: action.payload };
    case 'SET_EXPLAINING': return { ...state, isExplaining: action.payload };
    case 'SET_GENERATING_PROMPT': return { ...state, isGeneratingPrompt: action.payload };
    case 'SET_ERROR': return { ...state, errorMessage: action.payload };
    case 'SET_CONVERT_ERROR': return { ...state, convertError: action.payload };
    case 'SET_EXPLAIN_ERROR': return { ...state, explainError: action.payload };
    case 'SET_PROMPT_ERROR': return { ...state, promptError: action.payload };
    case 'SET_OUTPUTS': {
      const newOutputs = { ...state.outputs };
      Object.keys(action.payload).forEach((key) => {
        const k = key as keyof OutputsByMode;
        newOutputs[k] = { ...newOutputs[k], ...action.payload[k] };
      });
      return { ...state, outputs: newOutputs };
    }
    case 'SET_USERNAME': return { ...state, username: action.payload };
    case 'SET_GITHUB_USERNAME': return { ...state, githubUsername: action.payload };
    case 'SET_AVATAR': return { ...state, avatarUrl: action.payload };
    case 'SET_CONVERT_LANGUAGE': return { ...state, convertLanguage: action.payload };
    case 'SET_HOVERED_LINE': return { ...state, hoveredLine: action.payload };
    case 'SET_TOAST': return { ...state, toastMessage: action.payload };
    case 'CLEAR_ALL':
      return {
        ...state,
        code: '',
        language: 'javascript',
        errorMessage: null,
        convertError: null,
        explainError: null,
        promptError: null,
        outputs: {
          simple: { snippet: null, fullAnalysis: null, lineExplanations: [], generatedPrompt: '' },
          medium: { snippet: null, fullAnalysis: null, lineExplanations: [], generatedPrompt: '' },
          advanced: { snippet: null, fullAnalysis: null, lineExplanations: [], generatedPrompt: '' },
        },
        convertLanguage: '',
        hoveredLine: null,
        loading: false,
        isConverting: false,
        isExplaining: false,
        isGeneratingPrompt: false,
      };
    case 'CLEAR_CURRENT_OUTPUT': {
      const mode = state.mode;
      return {
        ...state,
        errorMessage: null,
        convertError: null,
        explainError: null,
        promptError: null,
        outputs: {
          ...state.outputs,
          [mode]: {
            snippet: null,
            fullAnalysis: null,
            lineExplanations: [],
            generatedPrompt: '',
          }
        },
        convertLanguage: '',
        hoveredLine: null,
        loading: false,
        isConverting: false,
        isExplaining: false,
        isGeneratingPrompt: false,
      };
    }
    default: return state;
  }
}

export default function Home() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const {
    code, language, mode, loading, isConverting, isExplaining, isGeneratingPrompt,
    errorMessage, convertError, explainError, promptError, outputs,
    username, githubUsername, avatarUrl, convertLanguage, hoveredLine, toastMessage,
  } = state;

  const abortControllerRef = useRef<AbortController | null>(null);
  const outputPanelRef = useRef<any>(null);

  const showToast = useCallback((message: string) => {
    dispatch({ type: 'SET_TOAST', payload: message });
    setTimeout(() => dispatch({ type: 'SET_TOAST', payload: null }), 3000);
  }, []);

  const handleClearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    showToast('🧹 All content cleared!');
  }, [showToast]);

  const handleModeChange = useCallback((newMode: 'simple' | 'medium' | 'advanced') => {
    dispatch({ type: 'SET_MODE', payload: newMode });
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  const handleUsernameChange = useCallback((newUsername: string) => {
    dispatch({ type: 'SET_USERNAME', payload: newUsername });
  }, []);

  const handleGithubChange = useCallback((newGithub: string) => {
    dispatch({ type: 'SET_GITHUB_USERNAME', payload: newGithub });
  }, []);

  const handleAvatarChange = useCallback((newAvatar: string | null) => {
    dispatch({ type: 'SET_AVATAR', payload: newAvatar });
  }, []);

  useEffect(() => {
    if (code.trim().length > 0) {
      const detected = detectLanguage(code);
      if (detected.confidence !== 'low' && detected.language !== language) {
        dispatch({ type: 'SET_LANGUAGE', payload: detected.language });
      }
    }
  }, [code, language]);

  useEffect(() => {
    if (code.trim().length > 0 || language) {
      dispatch({ type: 'CLEAR_CURRENT_OUTPUT' });
    }
  }, [code, language]);

  const currentOutput = useMemo(() => outputs[mode], [outputs, mode]);
  const displaySnippet = useMemo(() => currentOutput.snippet, [currentOutput]);
  const displayFullAnalysis = useMemo(() => currentOutput.fullAnalysis, [currentOutput]);
  const displayLineExplanations = useMemo(() => currentOutput.lineExplanations, [currentOutput]);
  const displayGeneratedPrompt = useMemo(() => currentOutput.generatedPrompt, [currentOutput]);
  const modeDescription = useMemo(() => MODE_DESCRIPTIONS[mode], [mode]);

  const saveSnippet = useCallback(async (data: any) => {
    const res = await fetch('/api/create-snippet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Save failed');
    return result;
  }, []);

  const updateSnippet = useCallback(async (slug: string, data: any) => {
    const res = await fetch(`/api/update-snippet/${slug}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.NEXT_PUBLIC_API_KEY || '',
      },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Update failed');
    return result;
  }, []);

  const handleSnippetUpdate = useCallback((data: { username: string; github_username: string }) => {
    dispatch({
      type: 'SET_OUTPUTS',
      payload: {
        [mode]: {
          snippet: displaySnippet ? { ...displaySnippet, username: data.username, github_username: data.github_username } : null,
        }
      }
    });
  }, [mode, displaySnippet]);

  const processCode = useCallback((rawCode: string, lang: string): string => {
    let processed = removeComments(rawCode, lang);
    processed = removeEmptyLines(processed);
    return processed;
  }, []);

  const validateCode = useCallback((processedCode: string): string | null => {
    if (!processedCode.trim()) return 'Please enter your code.';
    if (!isCodeLike(processedCode)) return '⚠️ The input does not appear to be valid source code. Please paste your code and try again.';
    const lines = processedCode.split('\n').length;
    if (lines > MAX_LINES_GENERATE) return `Code exceeds ${MAX_LINES_GENERATE} lines (${lines} lines). Please shorten your code.`;
    if (processedCode.length > MAX_CODE_LENGTH) return `Code is too long (${processedCode.length} characters). Maximum is ${MAX_CODE_LENGTH} characters.`;
    return null;
  }, []);

  const callGenerateAPI = useCallback(async (processedCode: string, lang: string, modeType: typeof mode): Promise<GenerateResponse> => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: processedCode, language: lang, mode: modeType }),
      signal: abortControllerRef.current.signal,
    });
    const data: GenerateResponse = await res.json();
    if (!res.ok) throw new Error(data.error || 'AI generation failed');
    return data;
  }, []);

  const buildSnippetFromPayload = useCallback((
    saveResult: any,
    processedCode: string,
    lang: string,
    payload: any
  ): Snippet => {
    return {
      id: saveResult.id,
      slug: saveResult.slug,
      raw_code: processedCode,
      language: lang,
      card_title: payload.card_title || 'Code Analysis',
      key_concept: payload.key_concept || '',
      what_this_code_does: payload.what_this_code_does || '',
      debug_analysis: payload.debug_analysis || '-',
      optimization: payload.optimization || '-',
      linkedin_post: payload.linkedin_post || '',
      is_public: true,
      created_at: new Date().toISOString(),
      username: username || 'Developer',
      github_username: githubUsername || null,
      avatar_url: saveResult.avatar_url || null,
      card_image_url: null,
      code_walkthrough: payload.code_walkthrough || null,
      what_works_well: payload.what_works_well || null,
      bugs_and_risky_cases: payload.bugs_and_risky_cases || null,
      edge_cases: payload.edge_cases || null,
      performance_analysis: payload.performance_analysis || null,
      security_analysis: payload.security_analysis || null,
      production_readiness: payload.production_readiness || null,
      recommended_improvements: payload.recommended_improvements || null,
      improved_code: payload.improved_code || null,
      suggested_tests: payload.suggested_tests || null,
      scorecard: payload.scorecard || null,
      final_verdict_summary: payload.final_verdict_summary || null,
      final_verdict_approved: payload.final_verdict_approved || null,
      final_verdict_next_steps: payload.final_verdict_next_steps || null,
      line_explanations: null,
      generated_prompt: null,
      findings: payload.findings || null,
      execution_overview: payload.execution_overview || null,
      architectural_observations: payload.architectural_observations || null,
      recommended_actions: payload.recommended_actions || null,
      suggested_tests_new: payload.suggested_tests_new || null,
      complexity: payload.complexity || null,
      scorecard_new: payload.scorecard_new || null,
      verdict: payload.verdict || null,
      limitations: payload.limitations || null,
    };
  }, [username, githubUsername]);

  const prepareSaveData = useCallback((processedCode: string, lang: string, genData: GenerateResponse) => {
    const linkedin_post = genData.linkedin_post || 'Check out this code analysis! #Zbloue';
    if (mode === 'advanced') {
      const card_title = genData.title ?? genData.card_title ?? 'Code Analysis';
      const key_concept = genData.highLevelSummary ?? genData.key_concept ?? 'No summary provided.';
      const what_this_code_does = genData.codeWalkthrough && genData.codeWalkthrough.length > 0
        ? genData.codeWalkthrough.map((item) => item.explanation).join(' ')
        : 'No walkthrough provided.';
      const debug_analysis = genData.bugsAndRiskyCases && genData.bugsAndRiskyCases.length > 0
        ? genData.bugsAndRiskyCases.map((item) => item.issue).join('; ')
        : 'No bugs identified.';
      const optimization = genData.recommendedImprovements && genData.recommendedImprovements.length > 0
        ? genData.recommendedImprovements.map((item) => item.improvement).join('; ')
        : 'No improvements suggested.';
      return {
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
      };
    }
  }, [mode, username, githubUsername, avatarUrl]);

  const handleGenerate = useCallback(async () => {
    // 🔥 STEP 1: Set loading state IMMEDIATELY
    dispatch({ type: 'SET_LOADING', payload: true });

    // STEP 2: Process code (remove comments and empty lines)
    const processedCode = processCode(code, language);
    if (processedCode !== code) {
      dispatch({ type: 'SET_CODE', payload: processedCode });
    }

    // STEP 3: Validate
    const validationError = validateCode(processedCode);
    if (validationError) {
      dispatch({ type: 'SET_ERROR', payload: validationError });
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }

    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      // STEP 4: Call API
      const genData = await callGenerateAPI(processedCode, language, mode);
      const saveDataPayload = prepareSaveData(processedCode, language, genData);
      const saveResult = await saveSnippet(saveDataPayload);
      const newSnippet = buildSnippetFromPayload(saveResult, processedCode, language, saveDataPayload);
      const fullAnalysisData = mode === 'advanced' ? genData : { analysis: genData.analysis, linkedin_post: genData.linkedin_post };

      // STEP 5: Update outputs
      dispatch({
        type: 'SET_OUTPUTS',
        payload: {
          [mode]: {
            snippet: newSnippet,
            fullAnalysis: fullAnalysisData,
            lineExplanations: outputs[mode].lineExplanations || [],
            generatedPrompt: outputs[mode].generatedPrompt || '',
          }
        }
      });

      if (outputPanelRef.current) outputPanelRef.current.setActiveTab('explanation');
      showToast('✅ Code analyzed successfully!');
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        dispatch({ type: 'SET_ERROR', payload: null });
        return;
      }
      const message = error instanceof Error ? error.message : 'Unknown error occurred.';
      if (process.env.NODE_ENV === 'development') console.error('Error:', error);
      dispatch({ type: 'SET_ERROR', payload: message });
    } finally {
      // STEP 6: Turn off loading state
      dispatch({ type: 'SET_LOADING', payload: false });
      abortControllerRef.current = null;
    }
  }, [code, language, mode, outputs, processCode, validateCode, callGenerateAPI, prepareSaveData, saveSnippet, buildSnippetFromPayload, showToast]);

  const handleGenerateExplanation = useCallback(async () => {
    const trimmedCode = removeEmptyLines(code);
    if (!trimmedCode.trim()) { showToast('❌ Please enter some code first.'); return; }
    if (trimmedCode !== code) dispatch({ type: 'SET_CODE', payload: trimmedCode });

    const lines = trimmedCode.split('\n').filter((line: string) => line.trim().length > 0);
    if (lines.length > MAX_LINES_EXPLAIN) {
      const msg = `Code exceeds ${MAX_LINES_EXPLAIN} lines. Please shorten your code.`;
      dispatch({ type: 'SET_EXPLAIN_ERROR', payload: msg });
      showToast(`❌ ${msg}`);
      return;
    }

    dispatch({ type: 'SET_EXPLAIN_ERROR', payload: null });
    dispatch({ type: 'SET_EXPLAINING', payload: true });

    try {
      const res = await fetch('/api/explain-line-by-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmedCode, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate explanations');

      const explanations = data.explanations || [];
      dispatch({
        type: 'SET_OUTPUTS',
        payload: {
          [mode]: { lineExplanations: explanations }
        }
      });
      if (displaySnippet?.slug) {
        await updateSnippet(displaySnippet.slug, { line_explanations: explanations });
      }
      showToast(`✅ ${explanations.length || 0} line explanations generated!`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to generate explanations';
      if (process.env.NODE_ENV === 'development') console.error('Explanation error:', error);
      dispatch({ type: 'SET_EXPLAIN_ERROR', payload: message });
      showToast(`❌ ${message}`);
    } finally {
      dispatch({ type: 'SET_EXPLAINING', payload: false });
    }
  }, [code, language, mode, displaySnippet, updateSnippet, showToast]);

  const handleGeneratePrompt = useCallback(async () => {
    const trimmedCode = removeEmptyLines(code);
    if (!trimmedCode.trim()) { showToast('❌ Please enter some code first.'); return; }
    if (trimmedCode !== code) dispatch({ type: 'SET_CODE', payload: trimmedCode });

    const lines = trimmedCode.split('\n').filter((line: string) => line.trim().length > 0);
    if (lines.length > MAX_LINES_PROMPT) {
      const msg = `Code exceeds ${MAX_LINES_PROMPT} lines. Please shorten your code.`;
      dispatch({ type: 'SET_PROMPT_ERROR', payload: msg });
      showToast(`❌ ${msg}`);
      return;
    }

    dispatch({ type: 'SET_PROMPT_ERROR', payload: null });
    dispatch({ type: 'SET_GENERATING_PROMPT', payload: true });

    try {
      const res = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmedCode, language, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate prompt');

      const prompt = data.prompt || '';
      dispatch({
        type: 'SET_OUTPUTS',
        payload: {
          [mode]: { generatedPrompt: prompt }
        }
      });
      if (displaySnippet?.slug) {
        await updateSnippet(displaySnippet.slug, { generated_prompt: prompt });
      }
      showToast('✅ Prompt generated! Check the Prompt tab.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to generate prompt';
      if (process.env.NODE_ENV === 'development') console.error('Prompt generation error:', error);
      dispatch({ type: 'SET_PROMPT_ERROR', payload: message });
      showToast(`❌ ${message}`);
    } finally {
      dispatch({ type: 'SET_GENERATING_PROMPT', payload: false });
    }
  }, [code, language, mode, displaySnippet, updateSnippet, showToast]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      dispatch({ type: 'SET_LOADING', payload: false });
      showToast('⏹️ Generation stopped by user');
    }
  }, [showToast]);

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
    dispatch({ type: 'SET_CONVERT_ERROR', payload: null });
    dispatch({ type: 'SET_CONVERTING', payload: true });
    try {
      const res = await fetch('/api/convert-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmedCode, sourceLanguage: language, targetLanguage: targetLang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Conversion failed');
      const convertedCode = removeEmptyLines(data.convertedCode);
      dispatch({ type: 'SET_CODE', payload: convertedCode });
      dispatch({ type: 'SET_LANGUAGE', payload: targetLang });
      dispatch({ type: 'SET_CONVERT_LANGUAGE', payload: '' });
      showToast(`✅ Code converted to ${targetLang.toUpperCase()} successfully!`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to convert code';
      if (process.env.NODE_ENV === 'development') console.error('Conversion error:', error);
      dispatch({ type: 'SET_CONVERT_ERROR', payload: message });
      showToast(`❌ ${message}`);
    } finally {
      dispatch({ type: 'SET_CONVERTING', payload: false });
    }
  }, [code, language, showToast]);

  return (
    <main className="min-h-screen bg-[#f8f9fa] p-4 md:p-6 flex flex-col">
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
            {['simple', 'medium', 'advanced'].map((m) => (
              <button
                key={m}
                onClick={() => handleModeChange(m as typeof mode)}
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
            code={code}
            setCode={(newCode) => dispatch({ type: 'SET_CODE', payload: newCode })}
            language={language}
            setLanguage={(newLang) => dispatch({ type: 'SET_LANGUAGE', payload: newLang })}
            onGenerate={handleGenerate}
            loading={loading}
            convertLanguage={convertLanguage}
            setConvertLanguage={(val) => dispatch({ type: 'SET_CONVERT_LANGUAGE', payload: val })}
            onConvert={handleConvertCode}
            isConverting={isConverting}
            convertError={convertError}
            onExplain={handleGenerateExplanation}
            isExplaining={isExplaining}
            hoveredLine={hoveredLine}
            onLineHover={(line) => dispatch({ type: 'SET_HOVERED_LINE', payload: line })}
            onClear={handleClearAll}
            onGeneratePrompt={handleGeneratePrompt}
            isGeneratingPrompt={isGeneratingPrompt}
            onStop={handleStop}
          />
          <OutputPanel
            ref={outputPanelRef}
            snippet={displaySnippet}
            loading={loading}
            fullAnalysis={displayFullAnalysis}
            analysisMode={mode}
            onUsernameChange={handleUsernameChange}
            onGithubChange={handleGithubChange}
            onSnippetUpdate={handleSnippetUpdate}
            lineExplanations={displayLineExplanations}
            isExplaining={isExplaining}
            onGenerateExplanation={handleGenerateExplanation}
            hoveredLine={hoveredLine}
            onLineHover={(line) => dispatch({ type: 'SET_HOVERED_LINE', payload: line })}
            generatedPrompt={displayGeneratedPrompt}
            isGeneratingPrompt={isGeneratingPrompt}
            onAvatarChange={handleAvatarChange}
          />
        </div>
      </div>
      <HomeFooter />
    </main>
  );
}