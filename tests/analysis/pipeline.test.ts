// tests/integration/pipeline.test.ts

import { runAdvancedPipeline } from '@/lib/analysis/pipeline';

// این تست‌ها نیاز به OpenAI API دارند، بنابراین در CI ممکن است اجرا نشوند
// برای اجرا: npm test -- --testPathPattern=pipeline

describe('Pipeline Integration', () => {
  // در محیط CI از این تست‌ها صرف‌نظر می‌کنیم
  const isCI = process.env.CI === 'true';
  const testOrSkip = isCI ? test.skip : test;

  testOrSkip('should analyze simple JavaScript code', async () => {
    const code = `
      function add(a, b) {
        return a + b;
      }
    `;
    const result = await runAdvancedPipeline(code, 'javascript');
    expect(result.status).toBe('complete');
    expect(result.result).toBeDefined();
    expect(result.result?.linkedin_post).toBeDefined();
  }, 30000);

  testOrSkip('should analyze concurrency code', async () => {
    const code = `
      async function fetchData() {
        const response = await fetch('/api/data');
        return response.json();
      }
    `;
    const result = await runAdvancedPipeline(code, 'javascript');
    expect(result.status).toBe('complete');
    expect(result.result?.auditType).toBe('concurrency');
    expect(result.result?.findings.length).toBeGreaterThan(0);
  }, 30000);

  testOrSkip('should handle long code without timeout', async () => {
    const code = Array(600).fill('console.log("line");').join('\n');
    const result = await runAdvancedPipeline(code, 'javascript');
    // ممکن است به دلیل محدودیت خط رد شود، اما نباید timeout بخورد
    expect(result.status).toBeDefined();
  }, 60000);
});