// lib/mockData.ts

/**
 * Mock response data for testing and development purposes.
 * This simulates the structure of a full advanced analysis response.
 * Aligned with AdvancedAuditResultSchema.
 */

export const MOCK_RESPONSE = {
  schemaVersion: '1.0',
  auditType: 'concurrency',
  status: 'complete',
  language: 'java',
  summary: 'Advanced concurrency analysis completed. Found critical thread-starvation issues.',

  executionOverview: {
    entryPoints: ['build()', 'submitWithBulkhead()'],
    taskSubmissionPoints: ['executor.submit()'],
    blockingWaitPoints: ['future.get()'],
    sharedResources: ['executor', 'poolMap'],
    resourceLifecycle: ['no shutdown'],
  },

  findings: [
    {
      id: 'F-001',
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
      id: 'F-002',
      title: 'Missing Timeout on Future.get()',
      severity: 'high',
      confidence: 'definite', // changed from 'high' to valid enum
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

  architecturalObservations: [
    {
      title: 'Tight coupling between task submission and execution',
      explanation:
        'The design tightly couples task submission and execution, making it prone to thread starvation.',
      relatedFindingIds: ['F-001', 'F-002'],
    },
  ],

  recommendedActions: [
    {
      priority: 1,
      severity: 'critical',
      title: 'Refactor nested submission',
      action: 'Refactor nested task submission to use a separate executor.',
      relatedFindingIds: ['F-001'],
    },
    {
      priority: 2,
      severity: 'high',
      title: 'Add timeouts to Future.get()',
      action: 'Add timeouts to all future.get() calls.',
      relatedFindingIds: ['F-002'],
    },
    {
      priority: 3,
      severity: 'medium',
      title: 'Use bulkhead pattern',
      action: 'Consider using a bulkhead pattern to isolate task pools.',
      relatedFindingIds: ['F-001'],
    },
  ],

  suggestedTests: [
    {
      title: 'Deadlock test with fixed thread pool',
      purpose: 'Verify that deadlock occurs when nested submissions block',
      setup: ['FixedThreadPool(2)'],
      steps: ['Submit 2 outer tasks that block on inner tasks.'],
      expectedResult: 'Deadlock after 2 tasks.',
    },
    {
      title: 'Timeout test with hanging inner task',
      purpose: 'Ensure that timeout prevents indefinite blocking',
      setup: ['Simulate hanging inner task'],
      steps: ['Call get() without timeout.'],
      expectedResult: 'Thread hangs.',
    },
    {
      title: 'Concurrency test with varying pool sizes',
      purpose: 'Check scalability and liveness under different loads',
      setup: ['Vary pool size from 1 to 10'],
      steps: ['Submit varying numbers of tasks.'],
      expectedResult: 'No deadlock or starvation.',
    },
  ],

  complexity: {
    time: 'O(1)',
    space: 'O(1)',
    resourceGrowth: 'Linear',
    assumptions: ['Bounded pool', 'No external dependencies'],
  },

  scorecard: {
    correctness: 40,
    concurrencySafety: 20,
    liveness: 20,
    errorHandling: 40,
    resourceManagement: 30,
    maintainability: 50,
    productionReadiness: 30,
  },

  verdict: {
    status: 'requires-major-changes',
    explanation:
      'Critical concurrency defects must be fixed. Consider redesigning task submission logic.',
  },

  limitations: [
    'The analysis does not cover all edge cases, but the critical issues are identified.',
  ],

  linkedin_post:
    'Found critical thread-starvation deadlock in concurrent Java code. Nested submissions to same executor can cause all workers to block. Timeouts missing on Future.get(). Refactor with separate executors and add timeouts. #Concurrency #Java #CodeQuality',
};

/**
 * Mock response for simple mode
 * Aligned with GenerateResponse (legacy) structure
 */
export const MOCK_SIMPLE_RESPONSE = {
  analysis:
    'The code appears to be a simple task submission logic. It uses an executor to run tasks asynchronously. However, there is a potential issue with blocking calls that could lead to performance bottlenecks. Consider using asynchronous patterns or timeouts to avoid blocking the main thread.',
  linkedin_post:
    'Quick analysis of code: Task submission logic looks good, but watch out for blocking calls! #CodeReview #Java',
};

/**
 * Mock response for medium mode
 * Aligned with GenerateResponse (legacy) structure
 */
export const MOCK_MEDIUM_RESPONSE = {
  analysis:
    'The code implements a task submission mechanism using an executor. Key observations:\n- Tasks are submitted correctly.\n- However, future.get() is called without a timeout, which can cause blocking.\n- The thread pool size seems fixed, which might limit scalability.\n- Error handling is not robust; exceptions from inner tasks are not properly managed.\n\nSuggestions:\n- Use timeout parameters for future.get().\n- Implement proper exception handling.\n- Consider using a dynamic thread pool if workload varies.',
  linkedin_post:
    'Medium-level analysis: Code has good structure but needs better concurrency handling. Add timeouts and improve error handling. #CodeQuality #Java',
};