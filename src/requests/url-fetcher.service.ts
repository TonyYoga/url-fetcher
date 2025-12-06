import { Injectable } from '@nestjs/common';
import { UrlFetchResult } from './models/request-result.model';
import {
  HTTP_TIMEOUT_MS,
  MAX_CONTENT_LENGTH_BYTES,
  MAX_REDIRECTS,
} from 'src/common/constants';
import { SecureHttpClient } from 'src/security/http/secure-http.clents';
import { AppLogger } from 'src/common/logger/app-logger.service';

@Injectable()
export class UrlFetcherService {
  private readonly logger = AppLogger.create(UrlFetcherService.name);

  constructor(private readonly secureHttpClient: SecureHttpClient) {}

  async fetchOne(url: string): Promise<UrlFetchResult> {
    const startTime = Date.now();

    try {
      const response = await this.secureHttpClient.get(url, {
        timeout: HTTP_TIMEOUT_MS,
        maxRedirects: MAX_REDIRECTS,
        responseType: 'arraybuffer',
        maxContentLength: MAX_CONTENT_LENGTH_BYTES,
        validateStatus: () => true,
      });

      const finalUrl =
        response.request?.res?.responseUrl ?? url;
      const contentType = response.headers['content-type'] ?? null;

      let content: string | null = null;
      try {
        const buffer = response.data as Buffer;
        content = buffer.toString('utf-8');
      } catch (error) {
        this.logger.warn('Error parsing content', {
          event: 'fetch_parse_error',
          url,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        content = null;
      }

      this.logger.debug('URL fetched successfully', {
        event: 'fetch_success',
        url,
        finalUrl,
        statusCode: response.status,
        contentType,
        contentLength: content?.length ?? 0,
        durationMs: Date.now() - startTime,
      });

      return {
        url,
        finalUrl,
        statusCode: response.status ?? null,
        contentType,
        content,
        error: null,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.logger.error('Error fetching URL', {
        event: 'fetch_error',
        url,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      });

      return {
        url,
        finalUrl: null,
        statusCode: null,
        contentType: null,
        content: null,
        error: errorMessage,
      };
    }
  }

  async fetchMany(urls: string[]): Promise<UrlFetchResult[]> {
    this.logger.debug('Fetching multiple URLs', {
      event: 'fetch_batch_start',
      urlCount: urls.length,
    });

    const promises = urls.map((url) => this.fetchOne(url));
    const results = await Promise.all(promises);

    const successCount = results.filter((r) => r.error === null).length;
    const errorCount = results.filter((r) => r.error !== null).length;

    this.logger.info('Batch fetch completed', {
      event: 'fetch_batch_complete',
      urlCount: urls.length,
      successCount,
      errorCount,
    });

    return results;
  }
}
