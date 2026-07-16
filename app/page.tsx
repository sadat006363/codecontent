'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Editor from '@/components/Editor';
import OutputPanel from '@/components/OutputPanel';
import { Snippet, GenerateResponse } from '@/types';
import { detectLanguage } from '@/lib/languageDetector';
import { isCodeLike } from '@/lib/utils';
import { 
  MAX_LINES_GENERATE, 
  MAX_LINES_EXPLAIN, 
  MAX_LINES_PROMPT,
  MAX_CODE_LENGTH 
} from '@/lib/constants';
import { HomeHeader, ErrorDisplay, HomeFooter } from '@/components/home';

const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL || 'https://github.com/sadat006363/Zbloue';

const modeDescriptions = {
  simple: '⚡ Quick analysis for basic code review — fast and concise. Identifies obvious syntax errors and logic flaws.',
  medium: '📊 Balanced analysis with more details. Identifies functional bugs, edge cases (null, undefined, empty inputs), and provides actionable suggestions.',
  advanced: '🔬 Deep production-grade analysis. Includes security review, performance analysis (Big O), edge cases, improved code, test suggestions, and a scorecard.'
};

export default function Home() {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [mode, setMode] = useState<'simple' | 'medium' | 'advanced'>('simple');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ===== State‌های نمایشی (که در OutputPanel نشان داده می‌شوند) =====
  const [displaySnippet, setDisplaySnippet] = useState<Snippet | null>(null);
  const [displayFullAnalysis, setDisplayFullAnalysis] = useState<GenerateResponse | null>(null);
  const [displayLineExplanations, setDisplayLineExplanations] = useState<any[]>([]);
  const [displayGeneratedPrompt, setDisplayGeneratedPrompt] = useState<string>('');

  // ===== ذخیره خروجی‌های هر حالت به‌صورت جداگانه =====
  const [modeOutputs, setModeOutputs] = useState<{
    simple: { snippet: Snippet | null; fullAnalysis: GenerateResponse | null; lineExplanations: any[]; generatedPrompt: string; }
    medium: { snippet: Snippet | null; fullAnalysis: GenerateResponse | null; lineExplanations: any[]; generatedPrompt: string; }
    advanced: { snippet: Snippet | null; fullAnalysis: GenerateResponse | null; lineExplanations: any[]; generatedPrompt: string; }
  }>({
    simple: { snippet: null, fullAnalysis: null, lineExplanations: [], generatedPrompt: '' },
    medium: { snippet: null, fullAnalysis: null, lineExplanations: [], generatedPrompt: '' },
    advanced: { snippet: null, fullAnalysis: null, lineExplanations: [], generatedPrompt: '' },
  });

  const [username, setUsername] = useState<string>('Developer');
  const [githubUsername, setGithubUsername] = useState<string>('');

  const [convertLanguage, setConvertLanguage] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isExplaining, setIsExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);

  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const outputPanelRef = useRef<any>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ===== تابع تغییر حالت با نمایش خروجی ذخیره‌شده (در صورت وجود) =====
  const handleModeChange = useCallback((newMode: 'simple' | 'medium' | 'advanced') => {
    setMode(newMode);
    
    // خروجی‌های ذخیره‌شده برای حالت جدید را نمایش بده
    const output = modeOutputs[newMode];
    setDisplaySnippet(output.snippet);
    setDisplayFullAnalysis(output.fullAnalysis);
    setDisplayLineExplanations(output.lineExplanations);
    setDisplayGeneratedPrompt(output.generatedPrompt);
    setErrorMessage(null);

    if (outputPanelRef.current) {
      outputPanelRef.current.setActiveTab('explanation');
    }
  }, [modeOutputs]);

  // ===== تابع پاک کردن همه خروجی‌ها (وقتی سورس کد عوض می‌شود) =====
  const clearAllOutputs = useCallback(() => {
    setModeOutputs({
      simple: { snippet: null, fullAnalysis: null, lineExplanations: [], generatedPrompt: '' },
      medium: { snippet: null, fullAnalysis: null, lineExplanations: [], generatedPrompt: '' },
      advanced: { snippet: null, fullAnalysis: null, lineExplanations: [], generatedPrompt: '' },
    });
    setDisplaySnippet(null);
    setDisplayFullAnalysis(null);
    setDisplayLineExplanations([]);
    setDisplayGeneratedPrompt('');
    setErrorMessage(null);
  }, []);

  // ===== تشخیص تغییر سورس کد برای پاک کردن خروجی‌ها =====
  useEffect(() => {
    clearAllOutputs();
    // بعد از پاک کردن، تب را به state اولیه برگردان
    if (outputPanelRef.current) {
      outputPanelRef.current.setActiveTab('explanation');
    }
  }, [code, language]); // با تغییر کد یا زبان، خروجی‌ها پاک می‌شوند

  // ===== تشخیص زبان =====
  useEffect(() => {
    if (code.trim().length > 0) {
      const detected = detectLanguage(code);
      if (detected.confidence !== 'low' && detected.language !== language) {
        setLanguage(detected.language);
      }
    }
  }, [code, language]);

  const saveSnippet = useCallback(async (data: any) => {
    const res = await fetch('/api/create-snippet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Save failed');
    }
    return result;
  }, []);

  const handleSnippetUpdate = useCallback((data: { username: string; github_username: string }) => {
    setDisplaySnippet((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        username: data.username,
        github_username: data.github_username,
      };
    });
    // همچنین خروجی ذخیره‌شده در حالت فعلی را به‌روز کن
    setModeOutputs((prev) => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        snippet: prev[mode].snippet ? { ...prev[mode].snippet, username: data.username, github_username: data.github_username } : null,
      }
    }));
  }, [mode]);

  const handleConvertCode = useCallback(async (targetLang: string) => {
    if (!code.trim()) {
      setConvertError('Please enter some code first.');
      showToast('❌ Please enter some code first.');
      return;
    }

    if (targetLang === language) {
      setConvertError('Target language is the same as source language.');
      showToast('❌ Target language is the same as source language.');
      return;
    }

    if (['html', 'css', 'json'].includes(language)) {
      setConvertError(`Converting ${language} to other languages is not supported.`);
      showToast(`❌ Converting ${language} to other languages is not supported.`);
      return;
    }

    setIsConverting(true);
    setConvertError(null);

    try {
      const res = await fetch('/api/convert-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code,
          sourceLanguage: language,
          targetLanguage: targetLang,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Conversion failed');
      }

      setCode(data.convertedCode);
      setLanguage(targetLang);
      setConvertLanguage('');
      showToast(`✅ Code converted to ${targetLang.toUpperCase()} successfully!`);
      
    } catch (error: any) {
      console.error('Conversion error:', error);
      setConvertError(error.message || 'Failed to convert code');
      showToast(`❌ ${error.message || 'Conversion failed'}`);
    } finally {
      setIsConverting(false);
    }
  }, [code, language]);

  const handleGenerateExplanation = useCallback(async () => {
    if (!code.trim()) {
      setExplainError('Please enter some code first.');
      showToast('❌ Please enter some code first.');
      return;
    }

    if (outputPanelRef.current) {
      outputPanelRef.current.setActiveTab('line-by-line');
    }

    const cleanCode = code
      .split('\n')
      .filter((line: string) => line.trim() !== '')
      .join('\n');

    const lines = cleanCode.split('\n').filter((line: string) => line.trim().length > 0);
    if (lines.length > MAX_LINES_EXPLAIN) {
      setExplainError(`Code exceeds ${MAX_LINES_EXPLAIN} lines. Please shorten your code for line-by-line explanation.`);
      showToast(`❌ Code exceeds ${MAX_LINES_EXPLAIN} lines. Please shorten your code.`);
      return;
    }

    setIsExplaining(true);
    setExplainError(null);

    try {
      const res = await fetch('/api/explain-line-by-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode, language }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate explanations');
      }

      const explanations = data.explanations || [];
      setDisplayLineExplanations(explanations);
      
      // ذخیره در حالت فعلی
      setModeOutputs((prev) => ({
        ...prev,
        [mode]: { ...prev[mode], lineExplanations: explanations }
      }));
      
      showToast(`✅ ${explanations.length || 0} line explanations generated!`);
      
    } catch (error: any) {
      console.error('Explanation error:', error);
      setExplainError(error.message || 'Failed to generate explanations');
      showToast(`❌ ${error.message || 'Failed to generate explanations'}`);
    } finally {
      setIsExplaining(false);
    }
  }, [code, language, mode]);

  const handleGeneratePrompt = useCallback(async () => {
    if (!code.trim()) {
      setPromptError('Please enter some code first.');
      showToast('❌ Please enter some code first.');
      return;
    }

    if (outputPanelRef.current) {
      outputPanelRef.current.setActiveTab('prompt');
    }

    const cleanCode = code
      .split('\n')
      .filter((line: string) => line.trim() !== '')
      .join('\n');

    const lines = cleanCode.split('\n').filter((line: string) => line.trim().length > 0);
    if (lines.length > MAX_LINES_PROMPT) {
      setPromptError(`Code exceeds ${MAX_LINES_PROMPT} lines. Please shorten your code for prompt generation.`);
      showToast(`❌ Code exceeds ${MAX_LINES_PROMPT} lines. Please shorten your code.`);
      return;
    }

    setIsGeneratingPrompt(true);
    setPromptError(null);

    try {
      const res = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode, language }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate prompt');
      }

      const prompt = data.prompt || '';
      setDisplayGeneratedPrompt(prompt);
      
      setModeOutputs((prev) => ({
        ...prev,
        [mode]: { ...prev[mode], generatedPrompt: prompt }
      }));
      
      showToast('✅ Prompt generated! Check the Prompt tab.');
      
    } catch (error: any) {
      console.error('Prompt generation error:', error);
      setPromptError(error.message || 'Failed to generate prompt');
      showToast(`❌ ${error.message || 'Failed to generate prompt'}`);
    } finally {
      setIsGeneratingPrompt(false);
    }
  }, [code, language, mode]);

  const handleClearAll = useCallback(() => {
    setCode('');
    setLanguage('javascript');
    clearAllOutputs();
    setErrorMessage(null);
    setHoveredLine(null);
    setConvertLanguage('');
    setConvertError(null);
    setIsConverting(false);
    setIsExplaining(false);
    setExplainError(null);
    setPromptError(null);
    showToast('🧹 All content cleared!');
  }, [clearAllOutputs]);

  const handleGenerate = useCallback(async () => {
    if (!code.trim()) {
      setErrorMessage('Please enter your code.');
      return;
    }

    const cleanCode = code
      .split('\n')
      .filter(line => line.trim() !== '')
      .join('\n');

    if (cleanCode !== code) {
      setCode(cleanCode);
    }

    if (!cleanCode.trim()) {
      setErrorMessage('Please enter valid code.');
      return;
    }

    const isCode = isCodeLike(cleanCode);
    console.log('isCodeLike result:', isCode);

    if (!isCode) {
      setErrorMessage('⚠️ The input does not appear to be valid source code. Please paste your code and try again.');
      return;
    }

    const lines = cleanCode.split('\n').length;
    if (lines > MAX_LINES_GENERATE) {
      setErrorMessage(`Code exceeds ${MAX_LINES_GENERATE} lines (${lines} lines). Please shorten your code.`);
      return;
    }

    if (cleanCode.length > MAX_CODE_LENGTH) {
      setErrorMessage(`Code is too long (${cleanCode.length} characters). Maximum is ${MAX_CODE_LENGTH} characters.`);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const genRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode, language, mode }),
      });

      const genData: GenerateResponse = await genRes.json();
      if (!genRes.ok) {
        throw new Error(genData.error || 'AI generation failed');
      }

      const linkedin_post = genData.linkedin_post || 'Check out this code analysis! #Zbloue';

      let saveData;
      let fullAnalysisData = null;
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

        saveData = await saveSnippet({
          code: cleanCode,
          language,
          card_title,
          key_concept,
          what_this_code_does,
          debug_analysis,
          optimization,
          linkedin_post,
          username: username || 'Developer',
          github_username: githubUsername || null,
        });
        fullAnalysisData = genData;
      } else {
        const analysisText = genData.analysis || 'No analysis generated.';
        const summaryLines = analysisText.split('\n').slice(0, 4).join('\n');
        const card_title = mode === 'simple' ? 'Quick Analysis' : 'Standard Analysis';

        saveData = await saveSnippet({
          code: cleanCode,
          language,
          card_title,
          key_concept: summaryLines,
          what_this_code_does: analysisText,
          debug_analysis: '-',
          optimization: '-',
          linkedin_post,
          username: username || 'Developer',
          github_username: githubUsername || null,
        });
        fullAnalysisData = { analysis: analysisText, linkedin_post };
      }

      const newSnippet: Snippet = {
        id: saveData.id,
        slug: saveData.slug,
        raw_code: cleanCode,
        language,
        card_title: saveData.card_title || 'Code Analysis',
        key_concept: saveData.key_concept || '',
        what_this_code_does: saveData.what_this_code_does || '',
        debug_analysis: saveData.debug_analysis || '-',
        optimization: saveData.optimization || '-',
        linkedin_post: saveData.linkedin_post || '',
        is_public: true,
        created_at: new Date().toISOString(),
        username: username || 'Developer',
        github_username: githubUsername || null,
      };

      // ذخیره خروجی برای حالت فعلی
      setModeOutputs((prev) => ({
        ...prev,
        [mode]: {
          snippet: newSnippet,
          fullAnalysis: fullAnalysisData,
          lineExplanations: prev[mode].lineExplanations || [],
          generatedPrompt: prev[mode].generatedPrompt || '',
        }
      }));

      // نمایش خروجی فعلی
      setDisplaySnippet(newSnippet);
      setDisplayFullAnalysis(fullAnalysisData);

      if (outputPanelRef.current) {
        outputPanelRef.current.setActiveTab('explanation');
      }

    } catch (error: any) {
      console.error('Error:', error);
      setErrorMessage(error.message || 'Unknown error occurred.');
    } finally {
      setLoading(false);
    }
  }, [code, language, mode, saveSnippet, username, githubUsername]);

  return (
    <main className="min-h-screen bg-[#f8f9fa] p-4 md:p-6 flex flex-col">
      <div className="flex-1 max-w-7xl mx-auto w-full">
        {toastMessage && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-[#1a1a2e] text-white px-6 py-3 rounded-lg shadow-lg z-50 text-sm transition-all duration-300">
            {toastMessage}
          </div>
        )}

        <HomeHeader githubUrl={GITHUB_URL} />
        
        {/* ===== Analysis Mode ===== */}
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
            {modeDescriptions[mode]}
          </div>
        </div>

        <ErrorDisplay message={errorMessage} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8" style={{ minHeight: 'calc(100vh - 200px)' }}>
          <Editor
            code={code}
            setCode={setCode}
            language={language}
            setLanguage={setLanguage}
            onGenerate={handleGenerate}
            loading={loading}
            convertLanguage={convertLanguage}
            setConvertLanguage={setConvertLanguage}
            onConvert={handleConvertCode}
            isConverting={isConverting}
            convertError={convertError}
            onExplain={handleGenerateExplanation}
            isExplaining={isExplaining}
            hoveredLine={hoveredLine}
            onLineHover={setHoveredLine}
            onClear={handleClearAll}
            onGeneratePrompt={handleGeneratePrompt}
            isGeneratingPrompt={isGeneratingPrompt}
          />
          <OutputPanel
            ref={outputPanelRef}
            snippet={displaySnippet}
            loading={loading}
            fullAnalysis={displayFullAnalysis}
            analysisMode={mode}
            onUsernameChange={setUsername}
            onGithubChange={setGithubUsername}
            onSnippetUpdate={handleSnippetUpdate}
            lineExplanations={displayLineExplanations}
            isExplaining={isExplaining}
            onGenerateExplanation={handleGenerateExplanation}
            hoveredLine={hoveredLine}
            onLineHover={setHoveredLine}
            generatedPrompt={displayGeneratedPrompt}
            isGeneratingPrompt={isGeneratingPrompt}
          />
        </div>
      </div>

      <HomeFooter />
    </main>
  );
}