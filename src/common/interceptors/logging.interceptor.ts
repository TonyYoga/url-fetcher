import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { AppLogger } from '../logger/app-logger.service';
import { getRequestContext } from '../context/request-context';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = AppLogger.create('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const { method, path, body } = request;
    const requestCtx = getRequestContext();

    this.logger.info('Incoming request', {
      event: 'request_start',
      method,
      path,
      urlCount: body?.urls?.length,
      clientIp: requestCtx?.clientIp,
    });

    return next.handle().pipe(
      tap((response) => {
        const duration = requestCtx ? Date.now() - requestCtx.startTime : 0;
        
        this.logger.info('Request completed', {
          event: 'request_complete',
          method,
          path,
          statusCode: context.switchToHttp().getResponse().statusCode,
          durationMs: duration,
        });
      }),
      catchError((error) => {
        const duration = requestCtx ? Date.now() - requestCtx.startTime : 0;
        
        this.logger.error('Request failed', {
          event: 'request_error',
          method,
          path,
          statusCode: error.status || 500,
          errorMessage: error.message,
          durationMs: duration,
        });
        
        throw error;
      }),
    );
  }
}
