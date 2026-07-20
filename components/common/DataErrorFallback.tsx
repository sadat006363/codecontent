// ============================================================
// 📁 فایل: components/common/DataErrorFallback.tsx (جدید)
// ============================================================

'use client';

import { useState } from 'react';

interface DataErrorFallbackProps {
  error: Error | string;
  onRetry?: () => void;
  className?: string;
}

export default function DataErrorFallback({
  error,
  onRetry,
  className = '',
}: DataErrorFallbackProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const errorMessage = typeof error === 'string' ? error : error.message;

  return (
    <div
      className={`bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center max-w-2xl mx-auto ${className}`}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="text-4xl">⚠️</div>
        <h3 className="text-lg font-semibold text-red-400">Data Structure Error</h3>
        <p className="text-sm text-[#a6adc8]">
          The analysis data could not be loaded properly. This might be due to a
          temporary issue or an incomplete AI response.
        </p>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-[#6c7086] hover:text-[#89b4fa] transition-colors underline"
        >
          {isExpanded ? 'Hide details' : 'Show details'}
        </button>

        {isExpanded && (
          <div className="w-full mt-2 p-3 bg-[#1e1e2e] rounded-lg border border-[#313244] text-left">
            <p className="text-xs text-[#f38ba8] font-mono break-all whitespace-pre-wrap max-h-[200px] overflow-auto">
              {errorMessage}
            </p>
          </div>
        )}

        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 px-4 py-2 bg-[#4a86f7] hover:bg-[#3b6fd4] text-white text-sm rounded-md transition-colors"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  );
}