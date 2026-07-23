// tests/analysis/detector.test.ts

import { detectConcurrencySignals } from '@/lib/analysis/detector';

describe('Detector', () => {
  test('should detect async/await in JavaScript', () => {
    const code = `
      async function fetchData() {
        const data = await fetch('https://api.example.com');
        return data.json();
      }
    `;
    const result = detectConcurrencySignals(code, 'javascript');
    expect(result.requiresConcurrencyAudit).toBe(true);
    expect(result.signals.some((s) => s.type === 'ASYNC_FUNCTION')).toBe(true);
    expect(result.signals.some((s) => s.type === 'AWAIT')).toBe(true);
  });

  test('should detect Promise in JavaScript', () => {
    const code = `
      const promise = new Promise((resolve) => {
        setTimeout(() => resolve('done'), 1000);
      });
    `;
    const result = detectConcurrencySignals(code, 'javascript');
    expect(result.signals.some((s) => s.type === 'PROMISE')).toBe(true);
    expect(result.signals.some((s) => s.type === 'SETTIMEOUT')).toBe(true);
  });

  test('should detect Worker in JavaScript', () => {
    const code = `
      const worker = new Worker('worker.js');
      worker.postMessage('hello');
    `;
    const result = detectConcurrencySignals(code, 'javascript');
    expect(result.signals.some((s) => s.type === 'WORKER')).toBe(true);
  });

  test('should fallback to regex for non-JS languages', () => {
    const code = `
      ExecutorService executor = Executors.newFixedThreadPool(10);
      executor.submit(() -> {});
    `;
    const result = detectConcurrencySignals(code, 'java');
    expect(result.signals.some((s) => s.type === 'EXECUTOR')).toBe(true);
    expect(result.signals.some((s) => s.type === 'EXECUTOR_SUBMIT')).toBe(true);
    expect(result.requiresConcurrencyAudit).toBe(true);
  });

  test('should not detect concurrency in simple code', () => {
    const code = `
      function add(a, b) {
        return a + b;
      }
    `;
    const result = detectConcurrencySignals(code, 'javascript');
    expect(result.requiresConcurrencyAudit).toBe(false);
    expect(result.signals).toHaveLength(0);
  });

  test('should handle invalid code gracefully', () => {
    const code = `function invalid { syntax error }`;
    const result = detectConcurrencySignals(code, 'javascript');
    // با وجود خطای AST، باید به Regex برگردد
    expect(result).toBeDefined();
    expect(typeof result.requiresConcurrencyAudit).toBe('boolean');
  });
});