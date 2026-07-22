// components/snippet/SnippetJsonDropdown.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import { Snippet } from '@/types';

interface SnippetJsonDropdownProps {
  snippet: Snippet | null;
}

type JsonViewMode =
  | 'full'
  | 'findings'
  | 'scorecard'
  | 'verdict'
  | 'complexity'
  | 'recommendedActions'
  | 'improvedCode'
  | 'linkedinPost'
  | 'executionOverview'
  | 'architecturalObservations'
  | 'limitations'
  | 'debugTrace';

const viewModes: { id: JsonViewMode; label: string; icon: string }[] = [
  { id: 'full', label: 'Full Snippet JSON', icon: '📦' },
  { id: 'findings', label: 'Findings', icon: '🔍' },
  { id: 'scorecard', label: 'Scorecard', icon: '📊' },
  { id: 'verdict', label: 'Verdict', icon: '🏁' },
  { id: 'complexity', label: 'Complexity', icon: '📈' },
  { id: 'recommendedActions', label: 'Recommended Actions', icon: '🔧' },
  { id: 'improvedCode', label: 'Improved Code', icon: '✨' },
  { id: 'linkedinPost', label: 'LinkedIn Post', icon: '💼' },
  { id: 'executionOverview', label: 'Execution Overview', icon: '⚡' },
  { id: 'architecturalObservations', label: 'Architectural Observations', icon: '🏗️' },
  { id: 'limitations', label: 'Limitations', icon: '⚠️' },
  { id: 'debugTrace', label: 'Pipeline Trace (Full Chain)', icon: '🔬' },
];

export default function SnippetJsonDropdown({ snippet }: SnippetJsonDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<JsonViewMode>('full');
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!snippet) return null;

  const getJsonData = (): { label: string; data: unknown } => {
    const dataMap: Record<JsonViewMode, { label: string; data: unknown }> = {
      full: { label: 'Full Snippet Data', data: snippet },
      findings: { label: 'Findings', data: snippet.findings || [] },
      scorecard: {
        label: 'Scorecard',
        data: snippet.scorecard_new || snippet.scorecard || {},
      },
      verdict: { label: 'Verdict', data: snippet.verdict || {} },
      complexity: { label: 'Complexity', data: snippet.complexity || {} },
      recommendedActions: {
        label: 'Recommended Actions',
        data: snippet.recommended_actions || [],
      },
      improvedCode: {
        label: 'Improved Code',
        data: snippet.improved_code || null,
      },
      linkedinPost: {
        label: 'LinkedIn Post',
        data: snippet.linkedin_post || null,
      },
      executionOverview: {
        label: 'Execution Overview',
        data: snippet.execution_overview || {},
      },
      architecturalObservations: {
        label: 'Architectural Observations',
        data: snippet.architectural_observations || [],
      },
      limitations: {
        label: 'Limitations',
        data: snippet.limitations || [],
      },
      debugTrace: {
        label: 'Pipeline Trace - Full Analysis Chain',
        data: snippet.debug_trace || null,
      },
    };
    return dataMap[selectedMode];
  };

  const { label, data } = getJsonData();
  const jsonString = JSON.stringify(data, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy JSON:', error);
      alert('❌ Failed to copy JSON');
    }
  };

  const currentModeLabel = viewModes.find((m) => m.id === selectedMode)?.label || 'Full Snippet JSON';
  const currentModeIcon = viewModes.find((m) => m.id === selectedMode)?.icon || '📦';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200
          ${isOpen
            ? 'bg-[#4a86f7] text-white border border-[#4a86f7]'
            : 'bg-[#4a86f7]/10 text-[#89b4fa] border border-[#4a86f7]/30 hover:bg-[#4a86f7]/20 hover:border-[#4a86f7]/50'
          }
        `}
      >
        <span>{currentModeIcon}</span>
        <span className="hidden sm:inline">{currentModeLabel}</span>
        <span className="sm:hidden">📋</span>
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-[#1e1e2e] rounded-xl border border-[#313244] shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-2 border-b border-[#313244] bg-[#11111b]">
            <span className="text-xs font-medium text-[#6c7086] uppercase tracking-wider">
              📊 JSON Views
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            {viewModes.map((mode) => (
              <button
                key={mode.id}
                onClick={() => {
                  setSelectedMode(mode.id);
                  setIsOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors
                  ${selectedMode === mode.id
                    ? 'bg-[#4a86f7]/20 text-[#89b4fa]'
                    : 'text-[#a6adc8] hover:bg-[#2a2a3e]'
                  }
                `}
              >
                <span className="text-base">{mode.icon}</span>
                <span>{mode.label}</span>
                {selectedMode === mode.id && (
                  <span className="ml-auto text-[#4a86f7]">✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {!isOpen && (
        <div className="mt-3 rounded-lg border border-[#313244] overflow-hidden bg-[#0d0d14]">
          <div className="flex items-center justify-between px-3 py-2 bg-[#1a1a2e] border-b border-[#313244]">
            <span className="text-xs text-[#6c7086] font-medium">
              {currentModeIcon} {label}
            </span>
            <button
              onClick={handleCopy}
              className={`
                flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors
                ${copied
                  ? 'bg-green-500/20 text-green-400'
                  : 'text-[#6c7086] hover:text-[#89b4fa] hover:bg-[#2a2a3e]'
                }
              `}
            >
              {copied ? '✅ Copied!' : '📋 Copy'}
            </button>
          </div>
          <div className="p-3 max-h-[400px] overflow-auto">
            <pre className="text-xs text-[#cdd6f4] font-mono whitespace-pre-wrap break-all">
              {jsonString}
            </pre>
          </div>
        </div>
      )}

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1e1e2e;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #4a86f7;
          border-radius: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3b6fd4;
        }
      `}</style>
    </div>
  );
}