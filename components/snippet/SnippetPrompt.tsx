// ============================================================
// 📁 فایل: components/snippet/SnippetPrompt.tsx (جدید)
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
      <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
        <pre className="text-[#cdd6f4] text-sm whitespace-pre-wrap font-mono">
          {generatedPrompt}
        </pre>
      </div>
    </div>
  );
}