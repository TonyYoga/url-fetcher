import { Injectable, NotFoundException } from '@nestjs/common';
import { UrlFetcherService } from './url-fetcher.service';
import { RequestResult } from './models/request-result.model';
import { AppLogger } from 'src/common/logger/app-logger.service';

@Injectable()
export class RequestsService {
  private readonly logger = AppLogger.create(RequestsService.name);
  private readonly store = new Map<string, RequestResult>();

  constructor(private readonly urlFetcherService: UrlFetcherService) {}

  async create(urls: string[]) {
    const id = `req_${Date.now()}`;
    const createdAt = Date.now();

    this.logger.info('Creating fetch request', {
      event: 'request_create_start',
      requestId: id,
      urlCount: urls.length,
    });

    const results = await this.urlFetcherService.fetchMany(urls);

    const record: RequestResult = {
      id,
      createdAt,
      urls,
      results,
    };
    this.store.set(id, record);

    const successCount = results.filter((r) => r.error === null).length;
    const errorCount = results.filter((r) => r.error !== null).length;

    this.logger.info('Fetch request completed', {
      event: 'request_create_complete',
      requestId: id,
      urlCount: urls.length,
      successCount,
      errorCount,
    });

    return {
      id: record.id,
      createdAt: record.createdAt,
      count: record.urls.length,
    };
  }

  async getOne(id: string) {
    const record = this.store.get(id);

    if (!record) {
      this.logger.warn('Request not found', {
        event: 'request_not_found',
        requestId: id,
      });
      throw new NotFoundException(`Request not ${id} found`);
    }

    this.logger.debug('Request retrieved', {
      event: 'request_get',
      requestId: id,
      urlCount: record.urls.length,
    });

    return record;
  }
}
