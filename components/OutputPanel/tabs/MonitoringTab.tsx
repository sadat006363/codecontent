// components/OutputPanel/tabs/MonitoringTab.tsx
'use client';

import { useEffect, useState } from 'react';

interface Metric {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: number;
}

export default function MonitoringTab() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [report, setReport] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // هر ۳۰ ثانیه به‌روزرسانی
    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/metrics');
      const data = await response.json();
      if (data.success) {
        setMetrics(data.metrics);
        setReport(data.report);
      } else {
        setError(data.error || 'Failed to fetch metrics');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-[#4a86f7]/20 border-t-[#4a86f7] rounded-full animate-spin" />
          <p className="text-[#4a4a6a] text-sm">⏳ Loading metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 py-8">
        <p className="text-lg">❌ {error}</p>
        <button
          onClick={fetchMetrics}
          className="mt-4 text-[#4a86f7] hover:underline text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  // ===== گروه‌بندی متریک‌ها =====
  const llmCalls = metrics.filter((m) => m.name === 'llm.call.count');
  const llmDurations = metrics.filter((m) => m.name === 'llm.call.duration');
  const tokensInput = metrics.filter((m) => m.name === 'llm.tokens.input');
  const tokensOutput = metrics.filter((m) => m.name === 'llm.tokens.output');
  const costs = metrics.filter((m) => m.name === 'llm.cost.estimated');
  const cacheHits = metrics.filter((m) => m.name === 'cache.hit');
  const cacheMisses = metrics.filter((m) => m.name === 'cache.miss');
  const pipelineStatus = metrics.filter((m) => m.name === 'pipeline.status');
  const pipelineDurations = metrics.filter((m) => m.name === 'pipeline.duration');

  const totalCalls = llmCalls.reduce((sum, m) => sum + m.value, 0);
  const totalCost = costs.reduce((sum, m) => sum + m.value, 0);
  const avgDuration = llmDurations.length > 0
    ? llmDurations.reduce((sum, m) => sum + m.value, 0) / llmDurations.length
    : 0;
  const totalTokensInput = tokensInput.reduce((sum, m) => sum + m.value, 0);
  const totalTokensOutput = tokensOutput.reduce((sum, m) => sum + m.value, 0);
  const cacheHitCount = cacheHits.reduce((sum, m) => sum + m.value, 0);
  const cacheMissCount = cacheMisses.reduce((sum, m) => sum + m.value, 0);
  const cacheHitRate = cacheHitCount + cacheMissCount > 0
    ? Math.round((cacheHitCount / (cacheHitCount + cacheMissCount)) * 100)
    : 0;

  const pipelineSuccess = pipelineStatus.filter((m) => m.tags?.status === 'complete' || m.tags?.status === 'repaired');
  const pipelineFailed = pipelineStatus.filter((m) => m.tags?.status === 'failed_validation');
  const successRate = pipelineStatus.length > 0
    ? Math.round((pipelineSuccess.length / pipelineStatus.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* ===== Header ===== */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[#1a1a2e] flex items-center gap-2">
          <span>📊</span> Monitoring Dashboard
        </h2>
        <button
          onClick={fetchMetrics}
          className="text-xs text-[#4a86f7] hover:underline"
        >
          🔄 Refresh
        </button>
      </div>

      {/* ===== Summary Cards ===== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#f8f9fa] p-4 rounded-lg border border-[#d0d0d8]">
          <p className="text-xs text-[#6c7086]">Total LLM Calls</p>
          <p className="text-2xl font-bold text-[#1a1a2e]">{totalCalls}</p>
        </div>
        <div className="bg-[#f8f9fa] p-4 rounded-lg border border-[#d0d0d8]">
          <p className="text-xs text-[#6c7086]">Estimated Cost</p>
          <p className="text-2xl font-bold text-[#e53935]">${totalCost.toFixed(4)}</p>
        </div>
        <div className="bg-[#f8f9fa] p-4 rounded-lg border border-[#d0d0d8]">
          <p className="text-xs text-[#6c7086]">Avg Response Time</p>
          <p className="text-2xl font-bold text-[#1a1a2e]">{Math.round(avgDuration)}ms</p>
        </div>
        <div className="bg-[#f8f9fa] p-4 rounded-lg border border-[#d0d0d8]">
          <p className="text-xs text-[#6c7086]">Cache Hit Rate</p>
          <p className="text-2xl font-bold text-[#43a047]">{cacheHitRate}%</p>
        </div>
      </div>

      {/* ===== Token Usage ===== */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#f8f9fa] p-4 rounded-lg border border-[#d0d0d8]">
          <p className="text-xs text-[#6c7086]">Total Input Tokens</p>
          <p className="text-xl font-bold text-[#1a1a2e]">{totalTokensInput.toLocaleString()}</p>
        </div>
        <div className="bg-[#f8f9fa] p-4 rounded-lg border border-[#d0d0d8]">
          <p className="text-xs text-[#6c7086]">Total Output Tokens</p>
          <p className="text-xl font-bold text-[#1a1a2e]">{totalTokensOutput.toLocaleString()}</p>
        </div>
      </div>

      {/* ===== Pipeline Status ===== */}
      <div className="bg-[#f8f9fa] p-4 rounded-lg border border-[#d0d0d8]">
        <p className="text-sm font-medium text-[#1a1a2e] mb-2">Pipeline Status</p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-[#43a047] rounded-full" />
            <span className="text-sm text-[#4a4a6a]">Success: {pipelineSuccess.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-[#e53935] rounded-full" />
            <span className="text-sm text-[#4a4a6a]">Failed: {pipelineFailed.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#1a1a2e]">Success Rate: {successRate}%</span>
          </div>
        </div>
      </div>

      {/* ===== Recent Metrics Table ===== */}
      <div className="bg-[#f8f9fa] p-4 rounded-lg border border-[#d0d0d8]">
        <p className="text-sm font-medium text-[#1a1a2e] mb-2">Recent Activity</p>
        <div className="max-h-[200px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[#f8f9fa]">
              <tr className="border-b border-[#d0d0d8]">
                <th className="text-left py-1 text-[#6c7086] font-medium">Time</th>
                <th className="text-left py-1 text-[#6c7086] font-medium">Metric</th>
                <th className="text-right py-1 text-[#6c7086] font-medium">Value</th>
                <th className="text-left py-1 text-[#6c7086] font-medium">Tags</th>
              </tr>
            </thead>
            <tbody>
              {metrics.slice(-20).reverse().map((m, idx) => (
                <tr key={idx} className="border-b border-[#e8e8f0] last:border-0">
                  <td className="py-1 text-[#4a4a6a]">
                    {new Date(m.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-1 text-[#1a1a2e]">{m.name}</td>
                  <td className="py-1 text-right font-mono text-[#1a1a2e]">
                    {typeof m.value === 'number' ? m.value.toFixed(2) : m.value}
                  </td>
                  <td className="py-1 text-[#6c7086]">
                    {m.tags ? Object.entries(m.tags).map(([k, v]) => `${k}:${v}`).join(' ') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== Full Report (toggle) ===== */}
      <details className="bg-[#f8f9fa] p-4 rounded-lg border border-[#d0d0d8]">
        <summary className="cursor-pointer text-sm font-medium text-[#1a1a2e]">
          📄 View Full Report
        </summary>
        <pre className="mt-3 text-xs text-[#4a4a6a] whitespace-pre-wrap bg-white p-3 rounded border border-[#d0d0d8] max-h-[300px] overflow-y-auto">
          {report}
        </pre>
      </details>
    </div>
  );
}