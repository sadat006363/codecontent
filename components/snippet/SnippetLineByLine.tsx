// ============================================================
// 📁 فایل: components/snippet/SnippetLineByLine.tsx (جدید)
// ============================================================

'use client';

interface SnippetLineByLineProps {
  lineExplanations: any[];
}

export default function SnippetLineByLine({ lineExplanations }: SnippetLineByLineProps) {
  if (!lineExplanations || lineExplanations.length === 0) {
    return (
      <div className="mt-8 pt-6 border-t border-[#313244]">
        <div className="bg-[#11111b] p-6 rounded-lg border border-[#313244] text-center">
          <p className="text-[#a6adc8] text-sm">📝 No line-by-line explanations available for this snippet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 pt-6 border-t border-[#313244]">
      <h2 className="text-2xl font-bold text-white mb-4">📝 Line-by-Line Explanations</h2>
      <div className="space-y-3">
        {lineExplanations.map((item: any, index: number) => (
          <div key={index} className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
            <div className="flex items-start gap-3">
              <span className="text-[#89b4fa] font-mono text-sm min-w-[60px]">
                Line {item.lineNumber || index + 1}
              </span>
              <div className="flex-1">
                <pre className="text-[#cdd6f4] text-sm whitespace-pre-wrap font-mono">
                  {item.code || ''}
                </pre>
                <p className="text-[#a6adc8] text-sm mt-2">{item.explanation || 'No explanation provided.'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}