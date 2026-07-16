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
import { HomeHeader, ModeSelector, ErrorDisplay, HomeFooter } from '@/components/home';

const GITHUB_URL = process.env.NEXT_PUBLIC_GITHUB_URL || 'https://github.com/sadat006363/Zbloue';

export default function Home() {
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [mode, setMode] = useState<'simple' | 'medium' | 'advanced'>('simple');
  const [loading, setLoading] = useState(false);
  const [snippet, setSnippet] = useState<Snippet | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fullAnalysis, setFullAnalysis] = useState<GenerateResponse | null>(null);

  const [username, setUsername] = useState<string>('Developer');
  const [githubUsername, setGithubUsername] = useState<string>('');

  const [convertLanguage, setConvertLanguage] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [lineExplanations, setLineExplanations] = useState<any[]>([]);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);

  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const outputPanelRef = useRef<any>(null);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

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
    setSnippet((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        username: data.username,
        github_username: data.github_username,
      };
    });
  }, []);

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

      setLineExplanations(data.explanations || []);
      
      if (outputPanelRef.current) {
        outputPanelRef.current.setActiveTab('line-by-line');
      }
      
      showToast(`✅ ${data.explanations?.length || 0} line explanations generated!`);
      
    } catch (error: any) {
      console.error('Explanation error:', error);
      setExplainError(error.message || 'Failed to generate explanations');
      showToast(`❌ ${error.message || 'Failed to generate explanations'}`);
    } finally {
      setIsExplaining(false);
    }
  }, [code, language]);

  const handleGeneratePrompt = useCallback(async () => {
    if (!code.trim()) {
      setPromptError('Please enter some code first.');
      showToast('❌ Please enter some code first.');
      return;
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

      setGeneratedPrompt(data.prompt);
      
      if (outputPanelRef.current) {
        outputPanelRef.current.setActiveTab('prompt');
      }
      
      showToast('✅ Prompt generated! Check the Prompt tab.');
      
    } catch (error: any) {
      console.error('Prompt generation error:', error);
      setPromptError(error.message || 'Failed to generate prompt');
      showToast(`❌ ${error.message || 'Failed to generate prompt'}`);
    } finally {
      setIsGeneratingPrompt(false);
    }
  }, [code, language]);

  const handleClearAll = useCallback(() => {
    setCode('');
    setLanguage('javascript');
    setSnippet(null);
    setFullAnalysis(null);
    setLineExplanations([]);
    setErrorMessage(null);
    setHoveredLine(null);
    setGeneratedPrompt('');
    setConvertLanguage('');
    setConvertError(null);
    setIsConverting(false);
    setIsExplaining(false);
    setExplainError(null);
    setPromptError(null);
    showToast('🧹 All content cleared!');
  }, []);

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
    setSnippet(null);
    setFullAnalysis(null);
    setErrorMessage(null);
    setLineExplanations([]);
    setGeneratedPrompt('');
    setExplainError(null);
    setPromptError(null);

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
        setFullAnalysis(genData);
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
        setFullAnalysis({ analysis: analysisText, linkedin_post });
      }

      setSnippet({
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
      });

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
        <ModeSelector mode={mode} setMode={setMode} />
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
            snippet={snippet}
            loading={loading}
            fullAnalysis={fullAnalysis}
            analysisMode={mode}
            onUsernameChange={setUsername}
            onGithubChange={setGithubUsername}
            onSnippetUpdate={handleSnippetUpdate}
            lineExplanations={lineExplanations}
            isExplaining={isExplaining}
            onGenerateExplanation={handleGenerateExplanation}
            hoveredLine={hoveredLine}
            onLineHover={setHoveredLine}
            generatedPrompt={generatedPrompt}
            isGeneratingPrompt={isGeneratingPrompt}
          />
        </div>
      </div>

      <HomeFooter />
    </main>
  );
}