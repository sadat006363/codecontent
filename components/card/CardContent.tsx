'use client';
import { ThemeColors } from './themes';

interface CardContentProps {
  colors: ThemeColors;
  theme: string;
  language: string;
  title: string;
  summary: string;
  codeSnippet: string;
  createdAt?: string;
  showCode?: boolean;
}

export default function CardContent({ 
  colors, 
  theme, 
  language, 
  title, 
  summary, 
  codeSnippet,
  createdAt,
  showCode = true,
}: CardContentProps) {
  const getLanguageIcon = (lang: string) => {
    const icons: Record<string, string> = {
      javascript: '🟨',
      typescript: '🔵',
      python: '🐍',
      java: '☕',
      rust: '🦀',
      go: '🐹',
      html: '🌐',
      css: '🎨',
      json: '📦',
      bash: '💻',
      c: '⚙️',
      cpp: '⚡',
      csharp: '🎯',
      php: '🐘',
      ruby: '💎',
      swift: '🦅',
      kotlin: '📱',
      dart: '🎯',
      sql: '🗄️',
      yaml: '📋',
      xml: '📄',
      markdown: '📝',
      shell: '💻',
      powershell: '🪟',
      dockerfile: '🐳',
      graphql: '📊',
      vue: '🟩',
      svelte: '🟧',
    };
    return icons[lang.toLowerCase()] || '📄';
  };

  const getCodePreview = () => {
    if (!codeSnippet) return '';
    const lines = codeSnippet.split('\n').filter(line => line.trim().length > 0);
    if (lines.length === 0) return '';
    return lines.slice(0, Math.max(3, Math.min(8, lines.length))).join('\n');
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch {
      return '';
    }
  };

  // ===== تابع حذف علامت‌های ### و فرمت‌دهی متن =====
  const formatSummaryText = (text: string) => {
    if (!text) return '';
    
    // حذف علامت‌های ### از ابتدای خطوط
    let formatted = text.replace(/^###\s*/gm, '');
    
    // حذف علامت‌های ### که با خط جدید جدا شده‌اند
    formatted = formatted.replace(/\n###\s*/g, '\n');
    
    // تبدیل خطوط با - به لیست
    formatted = formatted.replace(/^-\s*/gm, '• ');
    
    // تبدیل **متن** به برجسته
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    return formatted;
  };

  const codePreview = getCodePreview();
  const totalLines = codeSnippet ? codeSnippet.split('\n').filter(l => l.trim()).length : 0;
  const isLightTheme = theme === 'light' || theme === 'white' || theme === 'lavender' || theme === 'silver';
  
  // ===== پردازش خلاصه برای حذف ### =====
  const processedSummary = formatSummaryText(summary);

  return (
    <div className="flex-1 flex flex-col justify-center z-10 py-2">
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 flex-wrap">
          <div 
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border"
            style={{ 
              backgroundColor: colors.accentLight,
              borderColor: colors.borderColor,
              color: colors.accent
            }}
          >
            <span className="text-base">{getLanguageIcon(language)}</span>
            {language.toUpperCase()} · Code Analysis
          </div>
          
          {createdAt && (
            <div 
              className="text-xs px-2 py-1 rounded-full border"
              style={{ 
                color: colors.textMuted,
                borderColor: colors.borderColor,
                backgroundColor: colors.glassBg,
              }}
            >
              📅 {formatDate(createdAt)}
            </div>
          )}
        </div>

        <h2 
          className="text-4xl font-extrabold leading-tight mb-2 line-clamp-2 mt-2"
          style={{ color: colors.textPrimary }}
        >
          {title || 'Code Analysis'}
        </h2>

        {showCode && codePreview && (
          <div 
            className="rounded-lg p-3 mb-3 font-mono text-sm overflow-hidden max-w-xl border relative"
            style={{ 
              backgroundColor: isLightTheme ? 'rgba(0,0,0,0.05)' : 'rgba(0,0,0,0.4)',
              borderColor: colors.borderColor
            }}
          >
            <pre 
              className="whitespace-pre-wrap break-words"
              style={{ 
                color: isLightTheme ? '#1a1a2e' : '#a6e3a1',
                fontSize: '13px',
                lineHeight: '1.6'
              }}
            >
              <code>{codePreview}</code>
            </pre>
            {totalLines > 8 && (
              <span 
                className="text-xs mt-1 inline-block"
                style={{ color: colors.textMuted }}
              >
                ... and {totalLines - 8} more lines
              </span>
            )}
          </div>
        )}

        {/* ===== نمایش خلاصه بدون علامت ### ===== */}
        <p 
          className="text-base leading-relaxed line-clamp-2"
          style={{ color: colors.textSecondary }}
          dangerouslySetInnerHTML={{ __html: processedSummary }}
        />
      </div>
    </div>
  );
}