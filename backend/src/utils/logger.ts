type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

function formatLog(level: LogLevel, message: string, meta?: any): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level}] ${message}${metaStr}`;
}

export const logger = {
  info: (msg: string, meta?: any) => console.log(formatLog('INFO', msg, meta)),
  warn: (msg: string, meta?: any) => console.warn(formatLog('WARN', msg, meta)),
  error: (msg: string, meta?: any) => console.error(formatLog('ERROR', msg, meta)),
  debug: (msg: string, meta?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(formatLog('DEBUG', msg, meta));
    }
  },
};
