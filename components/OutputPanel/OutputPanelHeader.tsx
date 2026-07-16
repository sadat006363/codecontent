'use client';
import { TabType } from './OutputPanel';

interface OutputPanelHeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  shareUrl?: string; // ✅ اضافه شد
  onCopyLink?: () => void; // ✅ اضافه شد
}

const tabs: { id: TabType; label: string; icon: string }[] = [
  { id: 'explanation', label: 'Explanation', icon: '📖' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'preview', label: 'Card', icon: '🖼️' },
  { id: 'analysis', label: 'Analysis', icon: '📊' },
  { id: 'line-by-line', label: 'Line by Line', icon: '📝' },
  { id: 'prompt', label: 'Prompt', icon: '📝' },
];

export default function OutputPanelHeader({ 
  activeTab, 
  setActiveTab, 
  shareUrl,
  onCopyLink 
}: OutputPanelHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b-2 border-[#d0d0d8] flex-wrap bg-[#f1f3f5] px-2">
      <div className="flex flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium transition ${
              activeTab === tab.id
                ? 'text-[#4a86f7] border-b-2 border-[#4a86f7] bg-white/30'
                : 'text-[#4a4a6a] hover:text-[#1a1a2e]'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ===== دکمه کپی لینک ===== */}
      {shareUrl && onCopyLink && (
        <button
          onClick={onCopyLink}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition border border-[#d0d0d8] text-[#4a4a6a] hover:text-[#4a86f7] hover:bg-[#f1f3f5] ml-2"
          title="Copy snippet link"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span className="hidden sm:inline">Copy Link</span>
        </button>
      )}
    </div>
  );
}