// ============================================================
// 📁 فایل: lib/analysis/detector.ts
// ============================================================
import { SIGNAL_WEIGHTS, ANALYSIS_CONFIG } from './config';
import { DetectorResult, DetectorSignal } from './types';

const CONCURRENCY_SIGNALS: Record<string, Array<{ pattern: RegExp; type: string }>> = {
  java: [
    { pattern: /\bThread\b/, type: 'THREAD' },
    { pattern: /\bRunnable\b/, type: 'RUNNABLE' },
    { pattern: /\bCallable\b/, type: 'CALLABLE' },
    { pattern: /\bExecutor\b/, type: 'EXECUTOR' },
    { pattern: /\bExecutorService\b/, type: 'EXECUTOR' },
    { pattern: /\bThreadPoolExecutor\b/, type: 'THREAD_POOL' },
    { pattern: /\bForkJoinPool\b/, type: 'THREAD_POOL' },
    { pattern: /\bCompletableFuture\b/, type: 'COMPLETABLE_FUTURE' },
    { pattern: /\bFuture\b/, type: 'FUTURE' },
    { pattern: /\bSemaphore\b/, type: 'SEMAPHORE' },
    { pattern: /\bCountDownLatch\b/, type: 'COUNT_DOWN_LATCH' },
    { pattern: /\bCyclicBarrier\b/, type: 'CYCLIC_BARRIER' },
    { pattern: /\bsynchronized\b/, type: 'SYNCHRONIZED' },
    { pattern: /\bvolatile\b/, type: 'VOLATILE' },
    { pattern: /\bLock\b/, type: 'LOCK' },
    { pattern: /\bReentrantLock\b/, type: 'LOCK' },
    { pattern: /\bBlockingQueue\b/, type: 'BLOCKING_QUEUE' },
    { pattern: /\bConcurrentHashMap\b/, type: 'CONCURRENT_MAP' },
    { pattern: /\bAtomicInteger\b/, type: 'ATOMIC' },
    { pattern: /\bLockSupport\b/, type: 'LOCK_SUPPORT' },
    { pattern: /\.submit\s*\(/, type: 'EXECUTOR_SUBMIT' },
    { pattern: /\.execute\s*\(/, type: 'EXECUTOR_EXECUTE' },
    { pattern: /\.get\s*\(/, type: 'FUTURE_GET' },
    { pattern: /\.tryAcquire\s*\(/, type: 'SEMAPHORE_TRY_ACQUIRE' },
    { pattern: /\.interrupt\s*\(/, type: 'INTERRUPT' },
    { pattern: /\.cancel\s*\(/, type: 'CANCEL' },
    { pattern: /\.sleep\s*\(/, type: 'SLEEP' },
    { pattern: /\.parallelStream\s*\(/, type: 'PARALLEL_STREAM' },
  ],
  javascript: [
    { pattern: /\bPromise\b/, type: 'PROMISE' },
    { pattern: /\basync\b/, type: 'ASYNC_AWAIT' },
    { pattern: /\bawait\b/, type: 'ASYNC_AWAIT' },
    { pattern: /\bWorker\b/, type: 'WORKER_THREAD' },
    { pattern: /\bSharedArrayBuffer\b/, type: 'SHARED_STATE' },
  ],
  typescript: [
    { pattern: /\bPromise\b/, type: 'PROMISE' },
    { pattern: /\basync\b/, type: 'ASYNC_AWAIT' },
    { pattern: /\bawait\b/, type: 'ASYNC_AWAIT' },
    { pattern: /\bWorker\b/, type: 'WORKER_THREAD' },
  ],
};

function getLanguageSignals(language: string): Array<{ pattern: RegExp; type: string }> {
  const normalized = language.toLowerCase();
  if (normalized.includes('java')) return CONCURRENCY_SIGNALS.java;
  if (normalized.includes('javascript') || normalized.includes('js')) return CONCURRENCY_SIGNALS.javascript;
  if (normalized.includes('typescript') || normalized.includes('ts')) return CONCURRENCY_SIGNALS.typescript;
  return CONCURRENCY_SIGNALS.java;
}

function getLineForMatch(code: string, matchIndex: number): number {
  const before = code.substring(0, matchIndex);
  return before.split('\n').length;
}

export function detectConcurrencySignals(
  code: string,
  language: string
): DetectorResult {
  const signals: DetectorSignal[] = [];
  const signalPatterns = getLanguageSignals(language);
  const seen = new Set<string>();

  for (const { pattern, type } of signalPatterns) {
    let match;
    const regex = new RegExp(pattern, 'g');
    while ((match = regex.exec(code)) !== null) {
      const key = `${type}-${match[0]}-${match.index}`;
      if (!seen.has(key)) {
        seen.add(key);
        const line = getLineForMatch(code, match.index);
        const weight = SIGNAL_WEIGHTS[type] || 1;
        signals.push({
          type,
          value: match[0].trim(),
          line,
          weight,
        });
      }
    }
  }

  const uniqueSignals = signals.filter(
    (s, idx, self) => idx === self.findIndex((t) => t.type === s.type && t.line === s.line)
  );
  uniqueSignals.sort((a, b) => a.line - b.line);

  const totalWeight = uniqueSignals.reduce((sum, s) => sum + s.weight, 0);
  const requiresConcurrencyAudit = totalWeight >= ANALYSIS_CONFIG.concurrencyThreshold;

  return {
    requiresConcurrencyAudit,
    score: totalWeight,
    signals: uniqueSignals,
  };
}