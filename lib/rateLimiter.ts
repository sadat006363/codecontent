// lib/rateLimiter.ts
import { NextRequest } from 'next/server';
import { MAX_REQUESTS_PER_IP, TIME_WINDOW } from '@/lib/constants';

const requestLog = new Map<string, { count: number; firstRequest: number }>();

export function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  return '127.0.0.1';
}

export function rateLimiter(ip: string): { allowed: boolean; message?: string } {
  const now = Date.now();
  const log = requestLog.get(ip);

  if (log) {
    if (now - log.firstRequest > TIME_WINDOW) {
      requestLog.set(ip, { count: 1, firstRequest: now });
      return { allowed: true };
    } else if (log.count >= MAX_REQUESTS_PER_IP) {
      return {
        allowed: false,
        message: `Too many requests. Maximum ${MAX_REQUESTS_PER_IP} requests per 24 hours.`,
      };
    } else {
      log.count += 1;
      requestLog.set(ip, log);
      return { allowed: true };
    }
  } else {
    requestLog.set(ip, { count: 1, firstRequest: now });
    return { allowed: true };
  }
}