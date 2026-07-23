// lib/analysis/detector.ts

import { ANALYSIS_CONFIG, SIGNAL_WEIGHTS } from './analysis.config';
import { DetectorResult, DetectorSignal } from './types';
import logger from '@/lib/logger';

// ============================================================
// 🔥 AST Parser (برای JavaScript و TypeScript)
// ============================================================

import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

// ============================================================
// 🔥 سیگنال‌های هم‌روندی بر اساس زبان (Regex برای زبان‌های دیگر)
// ============================================================

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
  python: [
    { pattern: /\bthreading\b/, type: 'THREADING' },
    { pattern: /\bmultiprocessing\b/, type: 'MULTIPROCESSING' },
    { pattern: /\basyncio\b/, type: 'ASYNC' },
    { pattern: /\bawait\b/, type: 'AWAIT' },
    { pattern: /\basync\s+def\b/, type: 'ASYNC_DEF' },
  ],
  // زبان‌های دیگر با Regex
};

// ============================================================
// 🔥 تشخیص با AST برای JavaScript/TypeScript
// ============================================================

function detectWithAST(code: string, language: string): DetectorSignal[] {
  const signals: DetectorSignal[] = [];
  const seen = new Set<string>();

  // فقط برای JavaScript و TypeScript از AST استفاده می‌کنیم
  const isJsTs = ['javascript', 'typescript', 'js', 'ts'].includes(language.toLowerCase());

  if (!isJsTs) {
    logger.debug('[Detector] AST not supported for language:', language);
    return signals;
  }

  try {
    const ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
      errorRecovery: true,
    });

    traverse(ast, {
      // ===== تشخیص async/await =====
      Function(path) {
        if (path.node.async) {
          const line = path.node.loc?.start.line || 0;
          const key = `ASYNC_FUNCTION-${line}`;
          if (!seen.has(key)) {
            seen.add(key);
            signals.push({
              type: 'ASYNC_FUNCTION',
              value: 'async function',
              line,
              weight: SIGNAL_WEIGHTS.ASYNC_AWAIT || 2,
            });
          }
        }
      },

      // ===== تشخیص await =====
      AwaitExpression(path) {
        const line = path.node.loc?.start.line || 0;
        const key = `AWAIT-${line}`;
        if (!seen.has(key)) {
          seen.add(key);
          signals.push({
            type: 'AWAIT',
            value: 'await',
            line,
            weight: SIGNAL_WEIGHTS.ASYNC_AWAIT || 2,
          });
        }
      },

      // ===== تشخیص Promise =====
      NewExpression(path) {
        if (t.isIdentifier(path.node.callee) && path.node.callee.name === 'Promise') {
          const line = path.node.loc?.start.line || 0;
          const key = `PROMISE-${line}`;
          if (!seen.has(key)) {
            seen.add(key);
            signals.push({
              type: 'PROMISE',
              value: 'new Promise()',
              line,
              weight: SIGNAL_WEIGHTS.PROMISE || 2,
            });
          }
        }
      },

      // ===== تشخیص Worker =====
      NewExpression(path) {
        if (t.isIdentifier(path.node.callee) && path.node.callee.name === 'Worker') {
          const line = path.node.loc?.start.line || 0;
          const key = `WORKER-${line}`;
          if (!seen.has(key)) {
            seen.add(key);
            signals.push({
              type: 'WORKER',
              value: 'new Worker()',
              line,
              weight: SIGNAL_WEIGHTS.WORKER_THREAD || 3,
            });
          }
        }
      },

      // ===== تشخیص setTimeout/setInterval =====
      CallExpression(path) {
        if (t.isIdentifier(path.node.callee)) {
          const name = path.node.callee.name;
          if (name === 'setTimeout' || name === 'setInterval') {
            const line = path.node.loc?.start.line || 0;
            const key = `${name}-${line}`;
            if (!seen.has(key)) {
              seen.add(key);
              signals.push({
                type: name.toUpperCase(),
                value: name + '()',
                line,
                weight: 1,
              });
            }
          }
        }
      },

      // ===== تشخیص Promise.all / Promise.race =====
      MemberExpression(path) {
        if (t.isIdentifier(path.node.object) && path.node.object.name === 'Promise') {
          if (t.isIdentifier(path.node.property)) {
            const prop = path.node.property.name;
            if (prop === 'all' || prop === 'race' || prop === 'any' || prop === 'allSettled') {
              const line = path.node.loc?.start.line || 0;
              const key = `Promise.${prop}-${line}`;
              if (!seen.has(key)) {
                seen.add(key);
                signals.push({
                  type: `PROMISE_${prop.toUpperCase()}`,
                  value: `Promise.${prop}()`,
                  line,
                  weight: 2,
                });
              }
            }
          }
        }
      },
    });

    logger.debug('[Detector] AST detection found', signals.length, 'signals');
  } catch (error) {
    logger.error('[Detector] AST parsing failed, falling back to regex:', error);
    // در صورت خطا، به Regex برگردیم
  }

  return signals;
}

// ============================================================
// 🔥 تشخیص با Regex (برای سایر زبان‌ها)
// ============================================================

function detectWithRegex(code: string, language: string): DetectorSignal[] {
  const signals: DetectorSignal[] = [];
  const normalized = language.toLowerCase();
  let patterns: Array<{ pattern: RegExp; type: string }> = [];

  if (normalized.includes('java')) {
    patterns = CONCURRENCY_SIGNALS.java;
  } else if (normalized.includes('python')) {
    patterns = CONCURRENCY_SIGNALS.python;
  } else {
    // زبان‌های دیگر از یک مجموعه عمومی استفاده می‌کنند
    patterns = CONCURRENCY_SIGNALS.java; // fallback
    logger.debug('[Detector] Using fallback regex patterns for language:', language);
  }

  const seen = new Set<string>();

  for (const { pattern, type } of patterns) {
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

  return signals;
}

// ============================================================
// 🔥 توابع کمکی
// ============================================================

function getLineForMatch(code: string, matchIndex: number): number {
  const before = code.substring(0, matchIndex);
  return before.split('\n').length;
}

// ============================================================
// 🔥 تابع اصلی تشخیص سیگنال‌های هم‌روندی (با لاگ‌گیری)
// ============================================================

export function detectConcurrencySignals(
  code: string,
  language: string
): DetectorResult {
  const startTime = Date.now();
  logger.debug('[Detector] Starting detection for language:', language);

  let signals: DetectorSignal[] = [];

  // ===== انتخاب روش تشخیص =====
  const isJsTs = ['javascript', 'typescript', 'js', 'ts'].includes(language.toLowerCase());

  if (isJsTs) {
    logger.debug('[Detector] Using AST-based detection for JS/TS');
    signals = detectWithAST(code, language);
  } else {
    logger.debug('[Detector] Using regex-based detection for', language);
    signals = detectWithRegex(code, language);
  }

  // ===== حذف سیگنال‌های تکراری =====
  const uniqueSignals = signals.filter(
    (s, idx, self) => idx === self.findIndex((t) => t.type === s.type && t.line === s.line)
  );
  uniqueSignals.sort((a, b) => a.line - b.line);

  const totalWeight = uniqueSignals.reduce((sum, s) => sum + s.weight, 0);
  const requiresConcurrencyAudit = totalWeight >= ANALYSIS_CONFIG.concurrencyThreshold;

  const duration = Date.now() - startTime;
  logger.debug('[Detector] Detection completed in', duration, 'ms, signals:', uniqueSignals.length, 'totalWeight:', totalWeight);

  return {
    requiresConcurrencyAudit,
    score: totalWeight,
    signals: uniqueSignals,
  };
}