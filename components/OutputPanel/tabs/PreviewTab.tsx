'use client';
import { useState, useEffect } from 'react';
import { CardTheme } from '@/components/card/themes';
import ThemeSelector from './ThemeSelector';

interface PreviewTabProps {
  snippet: any;
  selectedTheme: CardTheme;
  setSelectedTheme: (theme: CardTheme) => void;
  cardImageDataUrl: string | null;
  isGeneratingCard: boolean;
  showUsernameInput: boolean;
  setShowUsernameInput: (show: boolean) => void;
  tempUsername: string;
  setTempUsername: (name: string) => void;
  tempGithubUsername: string;
  setTempGithubUsername: (name: string) => void;
  isUpdating: boolean;
  updateCardImage: () => void;
  showToast: (message: string) => void;
  publicUrl: string;          // ← این از OutputPanel می‌آید
  appUrl: string;
  downloadCard: () => void;
  savedImageUrl?: string | null;
  isUploading?: boolean;
  hasUploaded?: boolean;
  onUploadImage?: () => Promise<void>;
}

const themes: CardTheme[] = [
  'dark', 'blue', 'purple', 'pink', 'gradient',
  'orange', 'gold', 'green', 'lavender', 'silver',
  'glass', 'light', 'white'
];

const getThemeBackground = (t: CardTheme): string => {
  const backgrounds: Record<CardTheme, string> = {
    dark: 'linear-gradient(135deg, #0a0a0a, #2a2a2a)',
    blue: 'linear-gradient(135deg, #1a1a2e, #4a86f7)',
    purple: 'linear-gradient(135deg, #2d1b4e, #a855f7)',
    pink: 'linear-gradient(135deg, #3d1a3d, #ec4899)',
    gradient: 'linear-gradient(135deg, #4a86f7, #ec4899)',
    orange: 'linear-gradient(135deg, #1a100a, #fb923c)',
    gold: 'linear-gradient(135deg, #1a150a, #fbbf24)',
    green: 'linear-gradient(135deg, #0a1a0f, #4ade80)',
    lavender: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
    silver: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)',
    glass: 'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
    light: 'linear-gradient(135deg, #f8f9fa, #dee2e6)',
    white: 'linear-gradient(135deg, #ffffff, #f8fafc)',
  };
  return backgrounds[t] || backgrounds.blue;
};

export default function PreviewTab({
  snippet,
  selectedTheme,
  setSelectedTheme,
  cardImageDataUrl,
  isGeneratingCard,
  showUsernameInput,
  setShowUsernameInput,
  tempUsername,
  setTempUsername,
  tempGithubUsername,
  setTempGithubUsername,
  isUpdating,
  updateCardImage,
  showToast,
  publicUrl,
  appUrl,
  downloadCard,
  savedImageUrl = null,
  isUploading = false,
  hasUploaded = false,
  onUploadImage,
}: PreviewTabProps) {
  const [showShareDropdown, setShowShareDropdown] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [localSavedImageUrl, setLocalSavedImageUrl] = useState<string | null>(savedImageUrl);
  const [localHasUploaded, setLocalHasUploaded] = useState<boolean>(hasUploaded);

  // ===== همگام‌سازی با props =====
  useEffect(() => {
    setLocalSavedImageUrl(savedImageUrl);
  }, [savedImageUrl]);

  useEffect(() => {
    setLocalHasUploaded(hasUploaded);
  }, [hasUploaded]);

  // ===== وقتی کارت جدید تولید شد، لینک ذخیره‌شده را پاک کن =====
  useEffect(() => {
    if (cardImageDataUrl && !isGeneratingCard) {
      setLocalSavedImageUrl(null);
      setLocalHasUploaded(false);
    }
  }, [cardImageDataUrl, isGeneratingCard]);

  // ============================================================
  // 🔥 استخراج slug از publicUrl (بهترین روش)
  // ============================================================
  const slug = publicUrl.split('/').pop() || snippet?.slug || '';

  // ============================================================
  // 🔥 لینک صفحه کارت (HTML) – برای کپی قبل از آپلود
  // ============================================================
  const cardPageUrl = `${appUrl}/snippet/${slug}/card?theme=${selectedTheme}`;

  // ============================================================
  // 🔥 دکمه کپی – اگر تصویر آپلود شده، لینک تصویر را کپی کن،
  // در غیر این صورت لینک صفحه کارت را کپی کن (نه صفحه اسنیپت)
  // ============================================================
  const handleCopyLink = async () => {
    const linkToCopy = localSavedImageUrl || cardPageUrl;
    try {
      await navigator.clipboard.writeText(linkToCopy);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      showToast(`✅ ${localSavedImageUrl ? 'Image link' : 'Card page link'} copied!`);
    } catch (error) {
      console.error('Copy failed:', error);
      showToast('❌ Failed to copy link');
    }
  };

  const handleUploadImage = async () => {
    if (onUploadImage) {
      await onUploadImage();
    } else {
      showToast('❌ Upload function not available');
    }
  };

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadCard();
    } catch (error) {
      console.error('Download error:', error);
      showToast('❌ Download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  const toggleDropdown = () => {
    setShowShareDropdown(!showShareDropdown);
  };

  const handleShare = (platform: string) => {
    setShowShareDropdown(false);
    const shareUrl = localSavedImageUrl || cardPageUrl;
    const title = snippet?.card_title || 'Check out this code analysis on Zbloue!';
    const fullText = `${title} - Analyze your code with AI and share it with the world! #Zbloue #CodeReview #AI #Developer`;

    switch (platform) {
      case 'linkedin':
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`, '_blank');
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(fullText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
        break;
      case 'whatsapp':
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(fullText + ' ' + shareUrl)}`, '_blank');
        break;
      case 'telegram':
        window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(title)}`, '_blank');
        break;
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* ===== هدر با دکمه‌ها ===== */}
      <div className="flex flex-wrap items-center justify-between w-full max-w-[600px]">
        <h2 className="text-lg font-semibold text-[#1a1a2e] flex items-center gap-2">
          <span>🖼️</span> Card Preview
        </h2>
        
        <div className="flex items-center gap-2 flex-wrap">
          {/* ===== دکمه کپی لینک ===== */}
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition border border-[#d0d0d8] text-[#4a4a6a] hover:text-[#4a86f7] hover:bg-[#f1f3f5]"
            title={localSavedImageUrl ? 'Copy image link' : 'Copy card page link'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            <span>{copySuccess ? '✅ Copied!' : (localSavedImageUrl ? 'Copy Image Link' : 'Copy Link')}</span>
          </button>

          {/* ===== دکمه آپلود تصویر ===== */}
          <button
            onClick={handleUploadImage}
            disabled={isUploading || !cardImageDataUrl || localHasUploaded}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition border ${
              isUploading || !cardImageDataUrl || localHasUploaded
                ? 'border-[#d0d0d8] text-[#a0a0b0] cursor-not-allowed bg-[#f8f9fa]'
                : 'border-[#4a86f7] text-[#4a86f7] hover:bg-[#f1f3f5]'
            }`}
            title={localHasUploaded ? 'Already uploaded' : 'Upload card image to get permanent link'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>{isUploading ? 'Uploading...' : (localHasUploaded ? '✅ Uploaded' : 'Upload Image')}</span>
          </button>

          {/* ===== دکمه دانلود کارت ===== */}
          <button
            onClick={handleDownload}
            disabled={isGeneratingCard || !cardImageDataUrl || isDownloading}
            className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition border ${
              isGeneratingCard || !cardImageDataUrl || isDownloading
                ? 'border-[#d0d0d8] text-[#a0a0b0] cursor-not-allowed bg-[#f8f9fa]'
                : 'border-[#d0d0d8] text-[#4a4a6a] hover:text-[#4a86f7] hover:bg-[#f1f3f5]'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>{isDownloading ? 'Downloading...' : 'Download'}</span>
          </button>

          {/* ===== دکمه اشتراک‌گذاری ===== */}
          <div className="relative">
            <button
              onClick={toggleDropdown}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition border ${
                showShareDropdown
                  ? 'bg-[#f1f3f5] text-[#4a86f7] border-[#4a86f7]'
                  : 'border-[#d0d0d8] text-[#4a4a6a] hover:text-[#4a86f7] hover:bg-[#f1f3f5]'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
              </svg>
              <span>Share</span>
              <svg className={`w-3 h-3 transition-transform ${showShareDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>

            {showShareDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-[#d0d0d8] py-1 z-50">
                <div className="px-3 py-2 text-xs font-medium text-[#6c7086] border-b border-[#e8e8f0]">
                  Share on
                </div>
                <button
                  onClick={() => handleShare('linkedin')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1a1a2e] hover:bg-[#f1f3f5] transition"
                >
                  <svg className="w-4 h-4 text-[#0a66c2]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  LinkedIn
                </button>
                <button
                  onClick={() => handleShare('twitter')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1a1a2e] hover:bg-[#f1f3f5] transition"
                >
                  <svg className="w-4 h-4 text-[#1DA1F2]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  Twitter
                </button>
                <button
                  onClick={() => handleShare('whatsapp')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1a1a2e] hover:bg-[#f1f3f5] transition"
                >
                  <svg className="w-4 h-4 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </button>
                <button
                  onClick={() => handleShare('telegram')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#1a1a2e] hover:bg-[#f1f3f5] transition"
                >
                  <svg className="w-4 h-4 text-[#0088cc]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                  Telegram
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Theme Selector ===== */}
      <div className="w-full max-w-[600px]">
        <ThemeSelector
          themes={themes}
          selectedTheme={selectedTheme}
          setSelectedTheme={setSelectedTheme}
          getThemeBackground={getThemeBackground}
          updateCardImage={updateCardImage}
        />
      </div>

      {/* ===== Username Input ===== */}
      <div className="w-full max-w-[600px]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUsernameInput(!showUsernameInput)}
            className="text-sm text-[#4a4a6a] hover:text-[#4a86f7] transition px-3 py-1 rounded-md border border-[#d0d0d8] hover:border-[#4a86f7]"
          >
            👤 {showUsernameInput ? 'Hide' : 'Change Name'}
          </button>
        </div>
      </div>

      {showUsernameInput && (
        <div className="w-full max-w-[600px] space-y-3 bg-[#f1f3f5] p-4 rounded-lg border-2 border-[#d0d0d8]">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#6c7086] pointer-events-none">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>
              <input
                type="text"
                value={tempUsername}
                onChange={(e) => setTempUsername(e.target.value)}
                placeholder="Your name (for card)"
                className="w-full px-3 py-2 rounded-md border-2 border-[#d0d0d8] text-sm focus:outline-none focus:border-[#4a86f7] transition bg-white pl-9"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#6c7086] pointer-events-none">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.15 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.62.24 2.85.12 3.15.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                </svg>
              </div>
              <input
                type="text"
                value={tempGithubUsername}
                onChange={(e) => setTempGithubUsername(e.target.value.trim())}
                placeholder="Enter your GitHub username only (e.g., sadat006363)"
                className="w-full px-3 py-2 rounded-md border-2 border-[#d0d0d8] text-sm focus:outline-none focus:border-[#4a86f7] transition bg-white pl-9"
              />
            </div>
          </div>
          
          <div className="flex gap-2 pt-2 border-t border-[#d0d0d8]">
            <button
              onClick={updateCardImage}
              disabled={isUpdating}
              className="flex-1 bg-[#4a86f7] hover:bg-[#3b6fd4] text-white px-4 py-2 rounded-md text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              💾 Update Card
            </button>
            <button
              onClick={() => setShowUsernameInput(false)}
              className="px-4 py-2 rounded-md text-sm border-2 border-[#d0d0d8] hover:bg-[#e8e8f0] transition"
            >
              Close
            </button>
          </div>
          
          <p className="text-xs text-[#6c7086] flex items-center gap-1">
            <span>💡</span> Enter your GitHub username only (e.g., sadat006363). The full URL will be generated automatically.
          </p>
        </div>
      )}

      {/* ===== Card Preview ===== */}
      {isGeneratingCard ? (
        <div className="flex items-center justify-center w-full max-w-[600px] h-[400px] bg-[#fafbfc] rounded-lg border-2 border-[#d0d0d8]">
          <p className="text-[#4a4a6a]">⏳ Generating card...</p>
        </div>
      ) : cardImageDataUrl ? (
        <img
          src={cardImageDataUrl}
          alt="Code Card Preview"
          className="w-full max-w-[600px] rounded-lg shadow-2xl border-2 border-[#d0d0d8]"
        />
      ) : (
        <div className="flex items-center justify-center w-full max-w-[600px] h-[400px] bg-[#fafbfc] rounded-lg border-2 border-[#d0d0d8]">
          <p className="text-[#4a4a6a]">No card generated</p>
        </div>
      )}

      {/* ===== لینک ذخیره‌شده (اگر وجود داشته باشد) ===== */}
      {localSavedImageUrl && (
        <div className="w-full max-w-[600px] text-xs text-[#6c7086] bg-[#f1f3f5] p-2 rounded border border-[#d0d0d8] break-all">
          <span className="font-medium">✅ Permanent image link:</span> {localSavedImageUrl}
        </div>
      )}
    </div>
  );
}