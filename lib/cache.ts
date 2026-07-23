// lib/cache.ts

type CacheValue = {
  data: unknown;
  timestamp: number;
};

class InMemoryCache {
  private store = new Map<string, CacheValue>();
  private ttlMs: number; // Time-to-live in milliseconds

  constructor(ttlSeconds: number = 86400) { // 24 hours default
    this.ttlMs = ttlSeconds * 1000;
  }

  private getKey(key: string): string {
    return `cache:${key}`;
  }

  set(key: string, value: unknown): void {
    const fullKey = this.getKey(key);
    this.store.set(fullKey, {
      data: value,
      timestamp: Date.now(),
    });
  }

  get<T>(key: string): T | null {
    const fullKey = this.getKey(key);
    const entry = this.store.get(fullKey);
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > this.ttlMs) {
      this.store.delete(fullKey);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.store.clear();
  }

  // حذف آیتم‌های منقضی‌شده (اختیاری)
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now - entry.timestamp > this.ttlMs) {
        this.store.delete(key);
      }
    }
  }
}

// نمونه Singleton برای استفاده در سراسر برنامه
export const cache = new InMemoryCache(86400); // 24 hours

// تابع کمکی برای تولید کلید کش از درخواست
export function getCacheKey(code: string, language: string, mode: string): string {
  // استفاده از هش ساده برای جلوگیری از طولانی شدن کلید
  const hash = require('crypto').createHash('sha256')
    .update(`${code}:${language}:${mode}`)
    .digest('hex')
    .slice(0, 16);
  return `${mode}:${language}:${hash}`;
}