// ============================================================
// 📁 فایل: components/snippet/SnippetPrompt.tsx (اصلاح‌شده با اسکرول)
// ============================================================

'use client';

interface SnippetPromptProps {
  generatedPrompt: string;
}

export default function SnippetPrompt({ generatedPrompt }: SnippetPromptProps) {
  if (!generatedPrompt) {
    return (
      <div className="mt-8 pt-6 border-t border-[#313244]">
        <div className="bg-[#11111b] p-6 rounded-lg border border-[#313244] text-center">
          <p className="text-[#a6adc8] text-sm">📝 No prompt generated for this snippet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 pt-6 border-t border-[#313244]">
      <h2 className="text-2xl font-bold text-white mb-4">📝 Generated Prompt</h2>
      {/* 🔥 اضافه کردن max-height و overflow-y-auto برای اسکرول */}
      <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244] max-h-[500px] overflow-y-auto custom-scrollbar">
        <pre className="text-[#cdd6f4] text-sm whitespace-pre-wrap font-mono">
          {generatedPrompt}
        </pre>
      </div>
      {/* استایل سفارشی برای اسکرول‌بار (اختیاری) */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1e1e2e;
          border-radius: 8px;
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