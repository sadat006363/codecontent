// lib/rateLimiter.ts

import { NextRequest } from 'next/server';
import { redis, isRedisAvailable } from './redis';
import { MAX_REQUESTS_PER_IP, TIME_WINDOW } from './constants';
import logger from './logger';

const memoryStore = new Map<string, { count: number; firstRequest: number }>();

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

function getRateLimitKey(ip: string): string {
  return `rate_limit:${ip}`;
}

export async function rateLimiter(ip: string): Promise<{ allowed: boolean; message?: string }> {
  const now = Date.now();

  // ===== Redis =====
  if (isRedisAvailable() && redis) {
    try {
      const key = getRateLimitKey(ip);
      const data = await redis.get<{ count: number; firstRequest: number }>(key);

      if (data) {
        if (now - data.firstRequest > TIME_WINDOW) {
          await redis.set(key, { count: 1, firstRequest: now }, { ex: Math.ceil(TIME_WINDOW / 1000) });
          return { allowed: true };
        } else if (data.count >= MAX_REQUESTS_PER_IP) {
          return {
            allowed: false,
            message: `Too many requests. Maximum ${MAX_REQUESTS_PER_IP} requests per 24 hours.`,
          };
        } else {
          await redis.set(key, { count: data.count + 1, firstRequest: data.firstRequest }, { ex: Math.ceil(TIME_WINDOW / 1000) });
          return { allowed: true };
        }
      } else {
        await redis.set(key, { count: 1, firstRequest: now }, { ex: Math.ceil(TIME_WINDOW / 1000) });
        return { allowed: true };
      }
    } catch (error) {
      logger.error('[RateLimiter] Redis error, falling back to memory:', error);
    }
  }

  // ===== Fallback: Memory =====
  const log = memoryStore.get(ip);

  if (log) {
    if (now - log.firstRequest > TIME_WINDOW) {
      memoryStore.set(ip, { count: 1, firstRequest: now });
      return { allowed: true };
    } else if (log.count >= MAX_REQUESTS_PER_IP) {
      return {
        allowed: false,
        message: `Too many requests. Maximum ${MAX_REQUESTS_PER_IP} requests per 24 hours.`,
      };
    } else {
      log.count += 1;
      memoryStore.set(ip, log);
      return { allowed: true };
    }
  } else {
    memoryStore.set(ip, { count: 1, firstRequest: now });
    return { allowed: true };
  }
}