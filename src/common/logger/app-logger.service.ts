import { Injectable, LoggerService, LogLevel, Scope } from '@nestjs/common';
import { getRequestContext } from '../context/request-context';

export interface LogContext {
  [key: string]: unknown;
}

/**
 * Application Logger with request context support
 * Provides structured JSON logging with automatic request ID inclusion
 */
@Injectable()
export class AppLogger implements LoggerService {
  private context?: string;

  /**
   * Create a child logger with a specific context
   * Use this in services: private readonly logger = AppLogger.create('ServiceName');
   */
  static create(context: string): AppLogger {
    const logger = new AppLogger();
    logger.context = context;
    return logger;
  }

  setContext(context: string) {
    this.context = context;
  }

  log(message: string, context?: LogContext | string): void {
    this.writeLog('info', message, context);
  }

  info(message: string, context?: LogContext): void {
    this.writeLog('info', message, context);
  }

  error(message: string, context?: LogContext | string, trace?: string): void {
    const ctx = typeof context === 'string' ? { error: context } : context;
    if (trace) {
      this.writeLog('error', message, { ...ctx, trace });
    } else {
      this.writeLog('error', message, ctx);
    }
  }

  warn(message: string, context?: LogContext | string): void {
    this.writeLog('warn', message, context);
  }

  debug(message: string, context?: LogContext | string): void {
    this.writeLog('debug', message, context);
  }

  verbose(message: string, context?: LogContext | string): void {
    this.writeLog('verbose', message, context);
  }

  fatal(message: string, context?: LogContext | string): void {
    this.writeLog('fatal', message, context);
  }

  private writeLog(
    level: LogLevel | 'info' | 'fatal',
    message: string,
    context?: LogContext | string,
  ): void {
    const requestCtx = getRequestContext();
    const timestamp = new Date().toISOString();

    // Parse context - could be string (legacy) or object
    const contextData: LogContext =
      typeof context === 'string' ? { context: context } : context || {};

    const logEntry = {
      timestamp,
      level,
      message,
      context: this.context,
      requestId: requestCtx?.requestId,
      ...contextData,
    };

    // Remove undefined values
    const cleanEntry = Object.fromEntries(
      Object.entries(logEntry).filter(([, v]) => v !== undefined),
    );

    const output = JSON.stringify(cleanEntry);

    switch (level) {
      case 'error':
      case 'fatal':
        console.error(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'debug':
      case 'verbose':
        console.debug(output);
        break;
      default:
        console.log(output);
    }
  }
}
