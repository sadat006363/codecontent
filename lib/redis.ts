// lib/redis.ts

import { Redis } from '@upstash/redis';

// ============================================================
// 🔥 کلاینت Redis با fallback برای محیط توسعه و build
// ============================================================

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

let redisClient: Redis | null = null;

// فقط در صورتی که URL معتبر باشد (با https شروع شود) و توکن وجود داشته باشد، client بساز
if (redisUrl && redisToken && redisUrl.startsWith('https://')) {
  try {
    redisClient = new Redis({
      url: redisUrl,
      token: redisToken,
    });
    console.log('✅ Redis client initialized');
  } catch (error) {
    console.warn('⚠️ Redis client initialization failed:', error);
    redisClient = null;
  }
} else {
  console.warn('⚠️ Redis credentials not found or invalid. Rate limiting will use in-memory fallback.');
}

export const redis = redisClient;

/**
 * بررسی اینکه Redis در دسترس است یا خیر
 */
export const isRedisAvailable = (): boolean => {
  return redis !== null;
};