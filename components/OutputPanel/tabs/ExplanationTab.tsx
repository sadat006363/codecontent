'use client';
import { safeString } from '@/lib/utils';
import { useState } from 'react';

interface ExplanationTabProps {
  snippet: any;
  isAdvanced: boolean;
  quickAnalysisText: string | null;
  analysisText: string;
  debugAnalysis: string;
  optimization: string;
  keyConcept: string;
  cardTitle: string;
}

export default function ExplanationTab({ 
  snippet, 
  isAdvanced, 
  quickAnalysisText,
  analysisText,
  debugAnalysis,
  optimization,
  keyConcept,
  cardTitle,
}: ExplanationTabProps) {
  const [copySuccess, setCopySuccess] = useState(false);
  
  // ===== تابع جمع‌آوری متن کامل برای کپی و دانلود =====
  const getFullContent = () => {
    let content = '';
    
    if (isAdvanced) {
      content += `📌 ${safeString(cardTitle)}\n\n`;
      content += `💡 Key Concept:\n${safeString(keyConcept)}\n\n`;
      content += `🔍 What This Code Does:\n${safeString(analysisText)}\n\n`;
      content += `🐛 Debug Analysis:\n${safeString(debugAnalysis)}\n\n`;
      content += `⚡ Optimization:\n${safeString(optimization)}\n\n`;
    } else {
      content += `📌 ${safeString(cardTitle)}\n\n`;
      content += `📝 Summary:\n${safeString(keyConcept)}\n\n`;
      if (debugAnalysis && debugAnalysis !== '-') {
        content += `🐛 Debug Analysis:\n${safeString(debugAnalysis)}\n\n`;
      }
    }
    
    return content;
  };

  const fullContent = getFullContent();

  // ============================================================
  // 🔥 دکمه کپی اختصاصی
  // ============================================================
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullContent);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  // ============================================================
  // 🔥 دکمه دانلود اختصاصی
  // ============================================================
  const handleDownload = () => {
    const blob = new Blob([fullContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `explanation-${snippet?.slug || Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ===== تابع پاک‌سازی آیکون‌های تکراری از ابتدای متن =====
  const cleanDuplicateIcons = (text: string) => {
    if (!text) return '';
    const iconPattern = /^[📝🐛⚡💡🔍🔧📊✅🧪🔒💼🖼️📖📌⭐🔬🛡️🏁✨🚨🛡️🧩]\s*/;
    return text.replace(iconPattern, '');
  };

  // ===== تابع پردازش متن برای حذف ### و فرمت‌دهی =====
  const formatText = (text: string) => {
    if (!text) return '';
    
    let formatted = text.replace(/^###\s*/gm, '');
    const lines = formatted.split('\n');
    const cleanedLines = lines.map(line => cleanDuplicateIcons(line));
    formatted = cleanedLines.join('\n');
    formatted = formatted.replace(/^-\s*/gm, '• ');
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    return formatted;
  };

  // ===== تابع تشخیص و نمایش بخش‌ها با آیکون =====
  const renderSection = (title: string, content: string) => {
    if (!content || content === '-') return null;
    
    const iconMap: Record<string, string> = {
      'summary': '📝',
      'key concept': '💡',
      'what this code does': '🔍',
      'debug analysis': '🐛',
      'optimization': '⚡',
      'critical issues': '🚨',
      'quick fix': '⚡',
      'code overview': '📌',
      'logical & edge case analysis': '🔍',
      'refactoring & improvements': '🔧',
      'high-level summary': '💡',
      'code walkthrough': '🧩',
      'what works well': '✅',
      'bugs and risky cases': '🐛',
      'edge cases': '🧪',
      'performance analysis': '⚡',
      'security analysis': '🔒',
      'production readiness': '🛡️',
      'recommended improvements': '🔧',
      'improved code': '✨',
      'suggested tests': '🧪',
      'scorecard': '📊',
      'final verdict': '🏁',
    };

    const lowerTitle = title.toLowerCase();
    let icon = '📌';
    
    for (const [key, value] of Object.entries(iconMap)) {
      if (lowerTitle.includes(key)) {
        icon = value;
        break;
      }
    }

    const cleanTitle = cleanDuplicateIcons(title);
    const formattedContent = formatText(content);

    return (
      <div className="mb-4">
        <h3 className="font-semibold text-[#4a86f7] flex items-center gap-2 mb-2">
          <span>{icon}</span> {cleanTitle}
        </h3>
        <div 
          className="text-[#1a1a2e] leading-relaxed whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: formattedContent }}
        />
      </div>
    );
  };

  // ===== تابع parse برای حالت Simple/Medium =====
  const parseQuickAnalysis = (text: string) => {
    if (!text) return null;
    
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const sections: { title: string; content: string }[] = [];
    let currentTitle = '';
    let currentContent: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('###') || trimmed.match(/^[📝🐛⚡💡🔍🔧📊✅🧪🔒💼🖼️📖📌⭐🔬🛡️🏁✨🚨🛡️🧩]\s/)) {
        if (currentTitle && currentContent.length > 0) {
          sections.push({
            title: currentTitle,
            content: currentContent.join('\n')
          });
        }
        currentTitle = trimmed
          .replace(/^###\s*/, '')
          .replace(/^[📝🐛⚡💡🔍🔧📊✅🧪🔒💼🖼️📖📌⭐🔬🛡️🏁✨🚨🛡️🧩]\s*/, '')
          .trim();
        currentContent = [];
      } else if (currentTitle) {
        currentContent.push(line);
      }
    }
    
    if (currentTitle && currentContent.length > 0) {
      sections.push({
        title: currentTitle,
        content: currentContent.join('\n')
      });
    }
    
    return sections.length > 0 ? sections : null;
  };

  return (
    <div className="space-y-4">
      {/* ============================================================
          🔥 دکمه‌های کپی و دانلود (ساخته شده با دست خودمان)
          ============================================================ */}
      <div className="flex justify-end items-center gap-3 pb-2 border-b-2 border-[#e8e8f0]">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition border border-[#d0d0d8] text-[#4a4a6a] hover:text-[#4a86f7] hover:bg-[#f1f3f5]"
          title="Copy all explanation content to clipboard"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          <span>{copySuccess ? '✅ Copied!' : 'Copy All'}</span>
        </button>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition border border-[#d0d0d8] text-[#4a4a6a] hover:text-[#4a86f7] hover:bg-[#f1f3f5]"
          title="Download explanation as text file"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>Download</span>
        </button>
      </div>

      {isAdvanced ? (
        // ===== حالت Advanced =====
        <div className="space-y-6">
          <h2 className="text-xl md:text-2xl font-bold text-[#1a1a2e] flex items-center gap-2">
            <span>📌</span> {safeString(cardTitle)}
          </h2>
          
          {renderSection('💡 Key Concept', keyConcept)}
          {renderSection('🔍 What This Code Does', analysisText)}
          {renderSection('🐛 Debug Analysis', debugAnalysis)}
          {renderSection('⚡ Optimization', optimization)}
        </div>
      ) : (
        // ===== حالت Simple/Medium =====
        <div className="space-y-6">
          <h2 className="text-xl md:text-2xl font-bold text-[#1a1a2e] flex items-center gap-2">
            <span>📌</span> {safeString(cardTitle)}
          </h2>
          
          {(() => {
            const sections = parseQuickAnalysis(keyConcept);
            if (sections && sections.length > 0) {
              return sections.map((section, idx) => (
                <div key={idx}>
                  {renderSection(section.title, section.content)}
                </div>
              ));
            }
            return renderSection('📝 Summary', keyConcept);
          })()}
          
          {debugAnalysis && debugAnalysis !== '-' && (
            renderSection('🐛 Debug Analysis', debugAnalysis)
          )}
        </div>
      )}
    </div>
  );
}