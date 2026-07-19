// ============================================================
// 📁 فایل: lib/logger.ts (جدید)
// ============================================================
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const levels: Record<LogLevel, string> = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
  debug: 'DEBUG',
};

function log(level: LogLevel, message: string, ...meta: any[]) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${levels[level]}]`;

  if (process.env.NODE_ENV === 'production' && level === 'debug') {
    return;
  }

  if (meta.length > 0) {
    console[level](prefix, message, ...meta);
  } else {
    console[level](prefix, message);
  }
}

export default {
  info: (msg: string, ...meta: any[]) => log('info', msg, ...meta),
  warn: (msg: string, ...meta: any[]) => log('warn', msg, ...meta),
  error: (msg: string, ...meta: any[]) => log('error', msg, ...meta),
  debug: (msg: string, ...meta: any[]) => log('debug', msg, ...meta),
};