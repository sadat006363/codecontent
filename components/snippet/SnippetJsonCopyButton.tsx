// components/snippet/SnippetJsonCopyButton.tsx

'use client';

import { useState } from 'react';
import { Snippet } from '@/types';

interface SnippetJsonCopyButtonProps {
  snippet: Snippet | null;
}

export default function SnippetJsonCopyButton({ snippet }: SnippetJsonCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleCopy = async () => {
    if (!snippet) {
      alert('❌ No snippet data available to copy.');
      return;
    }

    setIsLoading(true);

    try {
      const jsonString = JSON.stringify(snippet, null, 2);
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      console.error('Failed to copy JSON:', error);
      alert('❌ Failed to copy JSON. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleCopy}
      disabled={!snippet || isLoading}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200
        ${copied
          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
          : 'bg-[#4a86f7]/10 text-[#89b4fa] border border-[#4a86f7]/30 hover:bg-[#4a86f7]/20 hover:border-[#4a86f7]/50'
        }
        ${(!snippet || isLoading) && 'opacity-50 cursor-not-allowed'}
      `}
      title="Copy full JSON analysis to clipboard"
    >
      {isLoading ? (
        <div className="w-4 h-4 border-2 border-[#89b4fa]/30 border-t-[#89b4fa] rounded-full animate-spin" />
      ) : copied ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
        </svg>
      )}
      <span className="hidden sm:inline">
        {copied ? '✅ Copied!' : isLoading ? 'Copying...' : 'Copy JSON'}
      </span>
      <span className="sm:hidden">
        {copied ? '✅' : isLoading ? '⏳' : '📋'}
      </span>
    </button>
  );
}