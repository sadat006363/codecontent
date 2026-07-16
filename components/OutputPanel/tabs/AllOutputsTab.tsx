'use client';
import { CopyButton } from '@/components/common';

interface AllOutputsTabProps {
  snippet: any;
  showToast: (message: string) => void;
  appUrl: string;
}

export default function AllOutputsTab({
  snippet,
  showToast,
  appUrl,
}: AllOutputsTabProps) {
  const shareUrl = `${appUrl}/snippet/${snippet?.slug}`;

  // ===== بخش‌های موجود در صفحه اسنیپت =====
  const sections = [
    {
      icon: '💻',
      title: 'Source Code',
      description: 'The original code with syntax highlighting, ready to copy or download.',
    },
    {
      icon: '📖',
      title: 'Explanation',
      description: 'A clear summary of what the code does, including key concepts, debug analysis, and optimization suggestions.',
    },
    {
      icon: '💼',
      title: 'LinkedIn Post',
      description: 'A ready-to-share LinkedIn post with relevant hashtags to promote your code analysis.',
    },
    {
      icon: '🖼️',
      title: 'Code Card',
      description: 'A beautiful, shareable card with your code, theme options, QR code, and user info.',
    },
    {
      icon: '📊',
      title: 'Advanced Analysis',
      description: 'In-depth review including code walkthrough, performance analysis, security review, scorecard, and improved code suggestions.',
    },
    {
      icon: '📝',
      title: 'Line-by-Line Explanations',
      description: 'Each line of code is explained in detail, making it easy to understand the logic and flow.',
    },
    {
      icon: '📝',
      title: 'Generated Prompt',
      description: 'A professional prompt generated from your code, useful for documentation or team collaboration.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* ===== بخش توضیحی اصلی ===== */}
      <div className="bg-gradient-to-br from-[#4a86f7]/5 to-[#a855f7]/5 p-6 rounded-xl border border-[#4a86f7]/20">
        <div className="flex items-start gap-4">
          <div className="text-4xl mt-1">📄</div>
          <div>
            <h2 className="text-xl font-bold text-[#1a1a2e]">
              Snippet Page
            </h2>
            <p className="text-sm text-[#4a4a6a] mt-2 leading-relaxed">
              The <strong>Snippet Page</strong> is your complete report hub. It brings together
              <strong> all analysis outputs</strong> in one dedicated page — perfect for sharing,
              reviewing, or documenting your code.
              <br />
              <span className="text-xs text-[#6c7086]">
                💡 Use the buttons below to copy the link or open the full report in a new tab.
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-4">
              {/* ===== دکمه کپی لینک ===== */}
              <CopyButton
                text={shareUrl}
                label="🔗 Copy Link"
                tooltip="Copy snippet page link"
                onCopy={() => showToast('✅ Link copied!')}
              />
              {/* ===== دکمه باز کردن صفحه اسنیپت ===== */}
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-[#4a86f7] hover:bg-[#3b6fd4] text-white px-4 py-1.5 rounded-md text-sm font-medium transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Open Full Report
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ===== خلاصه اطلاعات اسنیپت ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-[#e8e8f0] p-3 text-center">
          <p className="text-xs text-[#6c7086]">📌 Title</p>
          <p className="text-sm font-medium text-[#1a1a2e] truncate">
            {snippet?.card_title || 'Untitled'}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-[#e8e8f0] p-3 text-center">
          <p className="text-xs text-[#6c7086]">💻 Language</p>
          <p className="text-sm font-medium text-[#1a1a2e]">
            {snippet?.language || 'Unknown'}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-[#e8e8f0] p-3 text-center">
          <p className="text-xs text-[#6c7086]">👤 User</p>
          <p className="text-sm font-medium text-[#1a1a2e]">
            {snippet?.username || 'Developer'}
          </p>
        </div>
        <div className="bg-white rounded-lg border border-[#e8e8f0] p-3 text-center">
          <p className="text-xs text-[#6c7086]">📅 Created</p>
          <p className="text-sm font-medium text-[#1a1a2e]">
            {snippet?.created_at 
              ? new Date(snippet.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : 'Unknown'}
          </p>
        </div>
      </div>

      {/* ===== توضیحات خط به خط محتوای صفحه اسنیپت ===== */}
      <div>
        <h3 className="text-sm font-semibold text-[#1a1a2e] flex items-center gap-2 mb-3">
          📋 What's Inside the Snippet Page?
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sections.map((section) => (
            <div
              key={section.title}
              className="bg-white rounded-lg border border-[#e8e8f0] p-3 hover:border-[#4a86f7] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{section.icon}</span>
                <span className="font-medium text-[#1a1a2e] text-sm">{section.title}</span>
              </div>
              <p className="text-xs text-[#4a4a6a] mt-1 leading-relaxed">
                {section.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ===== فوتر ===== */}
      <div className="text-center text-xs text-[#6c7086] border-t border-[#e8e8f0] pt-4">
        <p>
          🔗 Share the full report with anyone using the link above.
          <br />
          All outputs are available in one place for easy access and collaboration.
        </p>
      </div>
    </div>
  );
}