// lib/analysis/analysis.config.ts

export interface AnalysisConfig {
  concurrencyThreshold: number;
  maxLinesForAnalysis: number;
  maxRepairPasses: number;
  schemaVersion: string;
  scoreRange: { min: number; max: number };
}

export const ANALYSIS_CONFIG: AnalysisConfig = {
  concurrencyThreshold: 5,
  maxLinesForAnalysis: 500,
  maxRepairPasses: 2,
  schemaVersion: '1.0',
  scoreRange: { min: 0, max: 10 },
};

// 🔥 اضافه کردن وزن‌های جدید برای سیگنال‌های AST
export const SIGNAL_WEIGHTS: Record<string, number> = {
  EXECUTOR: 3,
  THREAD_POOL: 3,
  FUTURE_GET: 3,
  NESTED_SUBMISSION: 4,
  SEMAPHORE: 3,
  LOCK: 3,
  BLOCKING_QUEUE: 3,
  SYNCHRONIZED: 2,
  VOLATILE: 2,
  PARALLEL_STREAM: 2,
  COMPLETABLE_FUTURE: 2,
  COUNT_DOWN_LATCH: 3,
  CYCLIC_BARRIER: 3,
  ASYNC_AWAIT: 2,
  PROMISE: 2,
  WORKER_THREAD: 3,
  MUTEX: 3,
  // ===== سیگنال‌های جدید برای AST =====
  ASYNC_FUNCTION: 2,
  AWAIT: 2,
  PROMISE_ALL: 2,
  PROMISE_RACE: 2,
  PROMISE_ANY: 2,
  PROMISE_ALLSETTLED: 2,
  SETTIMEOUT: 1,
  SETINTERVAL: 1,
  WORKER: 3,
};