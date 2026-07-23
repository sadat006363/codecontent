// lib/monitoring.ts

import logger from './logger';

// ============================================================
// 🔥 Metrics جمع‌آوری ساده
// ============================================================

interface Metric {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: number;
}

const metrics: Metric[] = [];
const MAX_METRICS = 1000;

export function recordMetric(name: string, value: number, tags?: Record<string, string>): void {
  const metric: Metric = {
    name,
    value,
    tags,
    timestamp: Date.now(),
  };
  metrics.push(metric);
  if (metrics.length > MAX_METRICS) {
    metrics.shift();
  }
  logger.debug(`[Metric] ${name}: ${value}`, tags);
}

export function getMetrics(): Metric[] {
  return [...metrics];
}

export function clearMetrics(): void {
  metrics.length = 0;
}

// ============================================================
// 🔥 گزارش‌گیری ساده
// ============================================================

export function generateReport(): string {
  const now = Date.now();
  const lastHour = now - 60 * 60 * 1000;

  const recent = metrics.filter((m) => m.timestamp > lastHour);

  const summary: Record<string, { count: number; total: number; avg: number; max: number }> = {};

  for (const m of recent) {
    if (!summary[m.name]) {
      summary[m.name] = { count: 0, total: 0, avg: 0, max: 0 };
    }
    summary[m.name].count += 1;
    summary[m.name].total += m.value;
    summary[m.name].max = Math.max(summary[m.name].max, m.value);
  }

  for (const key of Object.keys(summary)) {
    summary[key].avg = summary[key].total / summary[key].count;
  }

  const lines = [
    '📊 Zbloue Metrics Report',
    '═══════════════════════════════════════',
    `Timestamp: ${new Date(now).toISOString()}`,
    `Total metrics in last hour: ${recent.length}`,
    '',
  ];

  for (const [name, data] of Object.entries(summary)) {
    lines.push(`${name}:`);
    lines.push(`  Count: ${data.count}`);
    lines.push(`  Total: ${data.total.toFixed(2)}`);
    lines.push(`  Avg: ${data.avg.toFixed(2)}`);
    lines.push(`  Max: ${data.max.toFixed(2)}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================
// 🔥 توابع ثبت Metrics اختصاصی
// ============================================================

export function recordLLMCall(
  provider: 'openai' | 'anthropic',
  model: string,
  durationMs: number,
  tokens: { input: number; output: number },
  success: boolean
): void {
  recordMetric('llm.call.count', 1, { provider, model, success: String(success) });
  recordMetric('llm.call.duration', durationMs, { provider, model });
  recordMetric('llm.tokens.input', tokens.input, { provider, model });
  recordMetric('llm.tokens.output', tokens.output, { provider, model });

  // هزینه تقریبی (قابل تنظیم)
  const costPerInputToken = provider === 'openai' ? 0.000005 : 0.000008;
  const costPerOutputToken = provider === 'openai' ? 0.000015 : 0.000024;
  const cost = tokens.input * costPerInputToken + tokens.output * costPerOutputToken;
  recordMetric('llm.cost.estimated', cost, { provider, model });
}

export function recordCacheHit(mode: string): void {
  recordMetric('cache.hit', 1, { mode });
}

export function recordCacheMiss(mode: string): void {
  recordMetric('cache.miss', 1, { mode });
}

export function recordPipelineStatus(status: string, durationMs: number): void {
  recordMetric('pipeline.status', 1, { status });
  recordMetric('pipeline.duration', durationMs, { status });
}

export function recordValidationResult(valid: boolean, issues: number): void {
  recordMetric('validation.valid', valid ? 1 : 0);
  if (issues > 0) {
    recordMetric('validation.issues', issues);
  }
}