'use client';
import { TabType } from './OutputPanel';

interface OutputPanelHeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

const tabs: { id: TabType; label: string; icon: string }[] = [
  { id: 'explanation', label: 'Explanation', icon: '📖' },
  { id: 'linkedin', label: 'LinkedIn', icon: '💼' },
  { id: 'preview', label: 'Card', icon: '🖼️' },
  { id: 'analysis', label: 'Analysis', icon: '📊' },
  { id: 'line-by-line', label: 'Line by Line', icon: '📝' },
  { id: 'prompt', label: 'Prompt', icon: '📝' },
  { id: 'all-outputs', label: 'All Outputs', icon: '📊' },
  { id: 'monitoring', label: 'Monitoring', icon: '📊' }, // 🔥 NEW
];

export default function OutputPanelHeader({ 
  activeTab, 
  setActiveTab 
}: OutputPanelHeaderProps) {
  return (
    <div className="flex items-center border-b-2 border-[#d0d0d8] flex-wrap bg-[#f1f3f5] px-2">
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
    </div>
  );
}