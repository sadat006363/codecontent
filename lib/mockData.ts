// lib/mockData.ts

/**
 * Mock response data for testing and development purposes.
 * This simulates the structure of a full advanced analysis response.
 */

export const MOCK_RESPONSE = {
  summary: 'Advanced concurrency analysis completed. Found critical thread-starvation issues.',
  findings: [
    {
      title: 'Nested Submission & Thread-Starvation Deadlock',
      severity: 'critical',
      confidence: 'definite',
      category: 'thread-starvation',
      evidence: [
        {
          startLine: 120,
          endLine: 120,
          code: 'executor.submit(block::body);',
          explanation: 'Inner task submitted to same executor.',
        },
        {
          startLine: 122,
          endLine: 122,
          code: 'future.get();',
          explanation: 'Outer task blocks on inner task.',
        },
      ],
      executionPath: [
        'build() → submitWithBulkhead() → createTask() → executor.submit() → future.get()',
      ],
      triggerConditions: [
        'Pool size = N',
        'N outer tasks submitted',
        'Each outer task blocks on inner task',
      ],
      consequence: 'All workers blocked, system deadlocked.',
      technicalExplanation:
        'Nested submission to the same executor causes deadlock if all workers are occupied.',
      remediation: 'Use separate executor for inner tasks.',
      relatedSymbols: ['executor', 'future'],
      testToReproduce: {
        title: 'Deadlock test',
        setup: ['FixedThreadPool(2)'],
        steps: ['Submit 2 outer tasks that block on inner tasks.'],
        expectedResult: 'Deadlock after 2 tasks.',
      },
    },
    {
      title: 'Missing Timeout on Future.get()',
      severity: 'high',
      confidence: 'high',
      category: 'liveness',
      evidence: [
        {
          startLine: 122,
          endLine: 122,
          code: 'future.get();',
          explanation: 'Blocking indefinitely without timeout.',
        },
      ],
      executionPath: ['submit() → future.get()'],
      triggerConditions: ['Inner task never completes'],
      consequence: 'Thread blocked forever.',
      technicalExplanation: 'Without timeout, the thread may hang indefinitely.',
      remediation: 'Use future.get(timeout, unit) with a timeout.',
      relatedSymbols: ['future', 'timeout'],
      testToReproduce: {
        title: 'Timeout test',
        setup: ['Simulate hanging inner task'],
        steps: ['Call get() without timeout.'],
        expectedResult: 'Thread hangs.',
      },
    },
  ],
  scorecard: {
    correctness: 4,
    concurrencySafety: 2,
    liveness: 2,
    errorHandling: 4,
    resourceManagement: 3,
    maintainability: 5,
    productionReadiness: 3,
  },
  verdict: {
    status: 'requires-major-changes',
    explanation: 'Critical concurrency defects must be fixed. Consider redesigning task submission logic.',
  },
  executionOverview:
    'The code uses an executor for concurrent tasks but suffers from nested submissions that lead to deadlock. Timeouts are missing.',
  architecturalObservations:
    'The design tightly couples task submission and execution, making it prone to thread starvation.',
  recommendedActions: [
    'Refactor nested task submission to use a separate executor.',
    'Add timeouts to all future.get() calls.',
    'Consider using a bulkhead pattern to isolate task pools.',
  ],
  suggestedTests: [
    'Deadlock test with fixed thread pool.',
    'Timeout test with hanging inner tasks.',
    'Concurrency test with varying pool sizes.',
  ],
  complexity: {
    overall: 'medium',
    temporal: 'high',
    structural: 'medium',
    cognitive: 'medium',
  },
  limitations:
    'The analysis does not cover all edge cases, but the critical issues are identified.',
};

/**
 * Mock response for simple mode
 */
export const MOCK_SIMPLE_RESPONSE = {
  analysis: 'The code appears to be a simple task submission logic. It uses an executor to run tasks asynchronously. However, there is a potential issue with blocking calls that could lead to performance bottlenecks. Consider using asynchronous patterns or timeouts to avoid blocking the main thread.',
  linkedin_post: 'Quick analysis of code: Task submission logic looks good, but watch out for blocking calls! #CodeReview #Java',
};

/**
 * Mock response for medium mode
 */
export const MOCK_MEDIUM_RESPONSE = {
  analysis: 'The code implements a task submission mechanism using an executor. Key observations:\n- Tasks are submitted correctly.\n- However, future.get() is called without a timeout, which can cause blocking.\n- The thread pool size seems fixed, which might limit scalability.\n- Error handling is not robust; exceptions from inner tasks are not properly managed.\n\nSuggestions:\n- Use timeout parameters for future.get().\n- Implement proper exception handling.\n- Consider using a dynamic thread pool if workload varies.',
  linkedin_post: 'Medium-level analysis: Code has good structure but needs better concurrency handling. Add timeouts and improve error handling. #CodeQuality #Java',
};