// app/api/metrics/route.ts

import { NextResponse } from 'next/server';
import { getMetrics, generateReport } from '@/lib/monitoring';
import logger from '@/lib/logger';

export async function GET() {
  try {
    const metrics = getMetrics();
    const report = generateReport();

    return NextResponse.json({
      success: true,
      metrics,
      report,
      count: metrics.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Metrics API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}