'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { cpp } from '@codemirror/lang-cpp';
import { php } from '@codemirror/lang-php';
import { EditorView } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { Decoration } from '@codemirror/view';

interface EditorProps {
  code: string;
  setCode: (val: string) => void;
  language: string;
  setLanguage: (val: string) => void;
  onGenerate: () => void;
  loading: boolean;
  convertLanguage?: string;
  setConvertLanguage?: (val: string) => void;
  onConvert?: (targetLang: string) => void;
  isConverting?: boolean;
  convertError?: string | null;
  onExplain?: () => void;
  isExplaining?: boolean;
  hoveredLine?: number | null;
  onLineHover?: (lineNumber: number | null) => void;
  onClear?: () => void;
  onGeneratePrompt?: () => void;
  isGeneratingPrompt?: boolean;
}

const SUPPORTED_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript', icon: '🟨' },
  { value: 'typescript', label: 'TypeScript', icon: '🔵' },
  { value: 'python', label: 'Python', icon: '🐍' },
  { value: 'java', label: 'Java', icon: '☕' },
  { value: 'rust', label: 'Rust', icon: '🦀' },
  { value: 'go', label: 'Go', icon: '🐹' },
  { value: 'html', label: 'HTML', icon: '🌐' },
  { value: 'css', label: 'CSS', icon: '🎨' },
  { value: 'json', label: 'JSON', icon: '📦' },
  { value: 'cpp', label: 'C++', icon: '⚡' },
  { value: 'php', label: 'PHP', icon: '🐘' },
];

const languageExtensions: Record<string, any> = {
  javascript: javascript(),
  typescript: javascript({ typescript: true }),
  python: python(),
  java: java(),
  rust: rust(),
  go: go(),
  html: html(),
  css: css(),
  json: json(),
  cpp: cpp(),
  php: php(),
};

const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  'js': 'javascript',
  'ts': 'typescript',
  'py': 'python',
  'java': 'java',
  'rs': 'rust',
  'go': 'go',
  'html': 'html',
  'htm': 'html',
  'css': 'css',
  'json': 'json',
  'cpp': 'cpp',
  'cxx': 'cpp',
  'cc': 'cpp',
  'c': 'c',
  'php': 'php',
  'rb': 'ruby',
  'swift': 'swift',
  'kt': 'kotlin',
  'dart': 'dart',
  'sql': 'sql',
  'sh': 'bash',
  'bash': 'bash',
  'md': 'markdown',
  'xml': 'xml',
  'yaml': 'yaml',
  'yml': 'yaml',
};

const highlightLineExtension = (lineNumber: number | null) => {
  if (lineNumber === null) return [];
  
  return [
    EditorView.decorations.of((view) => {
      const doc = view.state.doc;
      if (lineNumber > doc.lines) {
        return new RangeSetBuilder<Decoration>().finish();
      }
      
      const line = doc.line(lineNumber);
      const builder = new RangeSetBuilder<Decoration>();
      
      const decoration = Decoration.line({
        attributes: {
          style: 'background-color: rgba(74, 134, 247, 0.15); border-left: 3px solid #4a86f7; display: block;',
        },
      });
      
      builder.add(line.from, line.from, decoration);
      
      return builder.finish();
    }),
  ];
};

export default function Editor({
  code,
  setCode,
  language,
  setLanguage,
  onGenerate,
  loading,
  convertLanguage,
  setConvertLanguage,
  onConvert,
  isConverting,
  convertError,
  onExplain,
  isExplaining,
  hoveredLine,
  onLineHover,
  onClear,
  onGeneratePrompt,
  isGeneratingPrompt,
}: EditorProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        onGenerate();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onGenerate]);

  const detectLanguageFromExtension = (filename: string): string | null => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    return EXTENSION_TO_LANGUAGE[ext] || null;
  };

  const processFile = useCallback((file: File) => {
    setUploadProgress(0);
    
    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(progress);
      }
    };
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setCode(content);
        const detectedLang = detectLanguageFromExtension(file.name);
        if (detectedLang) {
          setLanguage(detectedLang);
        }
        setUploadProgress(100);
        setTimeout(() => setUploadProgress(null), 1500);
      }
    };
    reader.onerror = () => {
      alert('❌ Failed to read file. Please try again.');
      setUploadProgress(null);
    };
    reader.readAsText(file);
  }, [setCode, setLanguage]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer?.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDropEvent = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      const validExtensions = Object.keys(EXTENSION_TO_LANGUAGE);
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (validExtensions.includes(ext) || file.type.startsWith('text/')) {
        processFile(file);
      } else {
        alert('❌ Please drop a valid code file (.js, .py, .java, etc.)');
      }
    }
  }, [processFile]);

  const nonConvertible = ['html', 'css', 'json'];
  const canConvert = code.trim().length > 0 && !nonConvertible.includes(language);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  }, [processFile]);

  const handleClearCode = useCallback(() => {
    if (code.trim()) {
      if (confirm('Are you sure you want to clear all code and results?')) {
        setCode('');
        setUploadProgress(null);
        if (onClear) {
          onClear();
        }
      }
    } else {
      if (onClear) {
        onClear();
      }
    }
  }, [code, setCode, onClear]);

  const handleExplainClick = useCallback(() => {
    if (onExplain) {
      onExplain();
    }
  }, [onExplain]);

  const handleGeneratePromptClick = useCallback(() => {
    if (onGeneratePrompt) {
      onGeneratePrompt();
    }
  }, [onGeneratePrompt]);

  const lineHighlightExtensions = hoveredLine ? highlightLineExtension(hoveredLine) : [];

  return (
    <div 
      className="h-full flex flex-col bg-white rounded-xl border border-[#d0d0d8] overflow-hidden shadow-sm relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDropEvent}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".js,.ts,.py,.java,.rs,.go,.html,.htm,.css,.json,.cpp,.cxx,.cc,.c,.php,.rb,.swift,.kt,.dart,.sql,.sh,.bash,.md,.xml,.yaml,.yml,.txt"
        onChange={handleFileSelected}
      />

      {(isDragging || uploadProgress !== null) && (
        <div className="w-full h-1 bg-[#e8e8f0] relative overflow-hidden z-20">
          <div 
            className={`h-full ${uploadProgress === 100 ? 'bg-[#43a047]' : 'bg-[#4a86f7]'} transition-all duration-300 ease-out`}
            style={{ 
              width: uploadProgress !== null ? `${uploadProgress}%` : '100%',
            }}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 p-3 bg-[#f1f3f5] border-b border-[#d0d0d8]">
        <div className="flex items-center gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-white text-[#1a1a2e] text-sm rounded-md px-3 py-1.5 border border-[#d0d0d8] focus:outline-none focus:ring-2 focus:ring-[#4a86f7]"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.icon} {lang.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-[#1a1a2e]">🔄 Convert to:</span>
          <select
            value={convertLanguage || ''}
            onChange={(e) => {
              const newLang = e.target.value;
              if (setConvertLanguage) setConvertLanguage(newLang);
              if (newLang && onConvert && canConvert) {
                onConvert(newLang);
              }
            }}
            className="bg-white text-[#1a1a2e] text-sm rounded-md px-3 py-1 border border-[#d0d0d8] focus:outline-none focus:ring-2 focus:ring-[#4a86f7] disabled:opacity-50"
            disabled={!canConvert || isConverting}
          >
            <option value="">Select language...</option>
            {SUPPORTED_LANGUAGES
              .filter(lang => lang.value !== language && !nonConvertible.includes(lang.value))
              .map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.icon} {lang.label}
                </option>
              ))}
          </select>
          
          {isConverting && (
            <span className="text-sm text-[#4a86f7] animate-pulse">⏳ Converting...</span>
          )}
          {convertError && (
            <span className="text-xs text-red-500 truncate" title={convertError}>
              ⚠️ {convertError}
            </span>
          )}
          {canConvert && !isConverting && !convertError && (
            <span className="text-xs text-[#6c7086] whitespace-nowrap">↔️ Select a language above</span>
          )}
          {!canConvert && code.trim().length > 0 && nonConvertible.includes(language) && (
            <span className="text-xs text-[#6c7086] whitespace-nowrap">⚠️ {language.toUpperCase()} cannot be converted</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 bg-[#f8f9fa] border-b border-[#d0d0d8]">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onGenerate}
            disabled={loading || !code.trim()}
            className="flex items-center gap-1.5 bg-[#4a86f7] hover:bg-[#3b6fd4] text-white font-medium px-4 py-1.5 rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            {loading ? 'Generating...' : '✨ Generate'}
          </button>

          {onExplain && (
            <button
              onClick={handleExplainClick}
              disabled={!code.trim() || isExplaining}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border transition ${
                !code.trim() || isExplaining
                  ? 'bg-[#f1f3f5] text-[#a0a0b0] border-[#d0d0d8] cursor-not-allowed'
                  : 'bg-[#e8e8f0] hover:bg-[#d0d0d8] text-[#1a1a2e] border-[#d0d0d8] hover:border-[#4a86f7]'
              }`}
              title="Explain code line by line" // ✅ Tooltip اضافه شد
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="hidden sm:inline">{isExplaining ? 'Explaining...' : 'Explain'}</span>
            </button>
          )}

          {onGeneratePrompt && (
            <button
              onClick={handleGeneratePromptClick}
              disabled={!code.trim() || isGeneratingPrompt}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border transition ${
                !code.trim() || isGeneratingPrompt
                  ? 'bg-[#f1f3f5] text-[#a0a0b0] border-[#d0d0d8] cursor-not-allowed'
                  : 'bg-[#e8e8f0] hover:bg-[#d0d0d8] text-[#1a1a2e] border-[#d0d0d8] hover:border-[#4a86f7]'
              }`}
              title="Generate prompt from code" // ✅ Tooltip اضافه شد
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="hidden sm:inline">{isGeneratingPrompt ? 'Generating...' : 'Prompt'}</span>
            </button>
          )}

          {code.trim() && (
            <button
              onClick={handleClearCode}
              className="flex items-center gap-1 text-red-500 hover:text-red-700 transition-colors hover:bg-red-50 px-2 py-1 rounded-md border border-red-200 hover:border-red-300 text-sm"
              title="Clear all code and results"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span className="hidden sm:inline">Clear</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-[#4a4a6a] whitespace-nowrap">
          <span>Lines: {code.split('\n').length}</span>
          <span>Chars: {code.length}</span>
        </div>
      </div>

      {isDragging && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#4a86f7]/5 backdrop-blur-sm">
          <div className="w-64 h-64 rounded-2xl border-4 border-dashed border-[#4a86f7] bg-white/80 flex flex-col items-center justify-center gap-4 shadow-2xl transition-all duration-300">
            <svg className="w-16 h-16 text-[#4a86f7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div className="text-center">
              <p className="text-[#1a1a2e] font-semibold text-lg">Drop your file here</p>
              <p className="text-[#6c7086] text-sm mt-1">.js, .py, .java, .cpp, .go, .rs, .html, .css, .json, .php, .rb, .swift, .kt, .dart, .sql, .sh, .md, .xml, .yaml</p>
            </div>
            {uploadProgress !== null && uploadProgress < 100 && (
              <div className="w-48 h-2 bg-[#e8e8f0] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#4a86f7] transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
            {uploadProgress === 100 && (
              <div className="flex items-center gap-2 text-[#43a047]">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                </svg>
                <span className="font-medium">Uploaded!</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden bg-[#fafbfc] relative">
        <CodeMirror
          value={code}
          height="100%"
          theme="light"
          extensions={[
            languageExtensions[language] || javascript(),
            ...lineHighlightExtensions,
          ]}
          onChange={(value) => setCode(value)}
          className="h-full"
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: true,
            foldGutter: true,
            autocompletion: true,
            tabSize: 2,
          }}
          placeholder="// Paste your code here... or drag & drop a file"
        />
        
        {!code.trim() && !isDragging && !uploadProgress && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              onClick={handleUploadClick}
              className="pointer-events-auto cursor-pointer w-64 h-64 rounded-2xl border-4 border-dashed border-[#d0d0d8] hover:border-[#4a86f7] bg-white/50 hover:bg-white/80 flex flex-col items-center justify-center gap-4 transition-all duration-300 group"
            >
              <div className="w-16 h-16 rounded-full bg-[#f1f3f5] group-hover:bg-[#e8e8f0] flex items-center justify-center transition-all">
                <svg className="w-8 h-8 text-[#6c7086] group-hover:text-[#4a86f7] transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-[#1a1a2e] font-medium text-lg group-hover:text-[#4a86f7] transition-all">
                  📤 Upload Code
                </p>
                <p className="text-[#6c7086] text-sm mt-1">
                  Click to upload or drag & drop
                </p>
                <p className="text-[#a0a0b0] text-xs mt-2">
                  .js .py .java .cpp .go .rs .html .css .json .php .rb .swift .kt .dart .sql .sh .md .xml .yaml
                </p>
              </div>
            </div>
          </div>
        )}
        
        {!isDragging && !uploadProgress && code.trim() && (
          <div className="absolute bottom-2 right-3 text-xs text-[#a0a0b0] pointer-events-none">
            <span>📂 Drag & drop to replace</span>
          </div>
        )}
      </div>
    </div>
  );
}