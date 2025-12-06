/**
 * Integration tests for RequestsService
 * Uses real RequestsService logic
 * Mocks: UrlFetcherService (makes external HTTP calls)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { UrlFetcherService } from './url-fetcher.service';
import { UrlFetchResult } from './models/request-result.model';

describe('RequestsService (integration)', () => {
  let service: RequestsService;
  let urlFetcherService: jest.Mocked<UrlFetcherService>;

  // Mock external HTTP responses
  const createMockFetchResult = (url: string, overrides?: Partial<UrlFetchResult>): UrlFetchResult => ({
    url,
    finalUrl: url,
    statusCode: 200,
    contentType: 'text/html',
    content: '<html>test</html>',
    error: null,
    ...overrides,
  });

  beforeEach(async () => {
    // Only mock UrlFetcherService - it makes external HTTP calls
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestsService, // Real service
        {
          provide: UrlFetcherService,
          useValue: {
            fetchMany: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RequestsService>(RequestsService);
    urlFetcherService = module.get(UrlFetcherService);
  });

  describe('create', () => {
    it('should create request and return summary with correct structure', async () => {
      const urls = ['https://example.com'];
      urlFetcherService.fetchMany.mockResolvedValue([
        createMockFetchResult('https://example.com'),
      ]);

      const result = await service.create(urls);

      expect(result).toEqual({
        id: expect.stringMatching(/^req_\d+$/),
        createdAt: expect.any(Number),
        count: 1,
      });
    });

    it('should pass URLs to fetcher', async () => {
      const urls = ['https://a.com', 'https://b.com'];
      urlFetcherService.fetchMany.mockResolvedValue([
        createMockFetchResult('https://a.com'),
        createMockFetchResult('https://b.com'),
      ]);

      await service.create(urls);

      expect(urlFetcherService.fetchMany).toHaveBeenCalledWith(urls);
    });

    it('should store results and make them retrievable', async () => {
      const urls = ['https://example.com'];
      const mockResult = createMockFetchResult('https://example.com');
      urlFetcherService.fetchMany.mockResolvedValue([mockResult]);

      const createResult = await service.create(urls);
      const stored = await service.getOne(createResult.id);

      expect(stored).toEqual({
        id: createResult.id,
        createdAt: createResult.createdAt,
        urls,
        results: [mockResult],
      });
    });

    it('should handle multiple URLs correctly', async () => {
      const urls = ['https://a.com', 'https://b.com', 'https://c.com'];
      const results = urls.map((url) => createMockFetchResult(url));
      urlFetcherService.fetchMany.mockResolvedValue(results);

      const result = await service.create(urls);

      expect(result.count).toBe(3);
    });

    it('should generate ID with timestamp format', async () => {
      urlFetcherService.fetchMany.mockResolvedValue([]);
      const beforeCreate = Date.now();

      const result = await service.create([]);

      const afterCreate = Date.now();
      const timestamp = parseInt(result.id.replace('req_', ''), 10);
      
      expect(timestamp).toBeGreaterThanOrEqual(beforeCreate);
      expect(timestamp).toBeLessThanOrEqual(afterCreate);
    });

    it('should handle empty URL array', async () => {
      urlFetcherService.fetchMany.mockResolvedValue([]);

      const result = await service.create([]);

      expect(result.count).toBe(0);
    });

    it('should store error results from fetcher', async () => {
      const errorResult = createMockFetchResult('https://error.com', {
        finalUrl: null,
        statusCode: null,
        contentType: null,
        content: null,
        error: 'Connection refused',
      });
      urlFetcherService.fetchMany.mockResolvedValue([errorResult]);

      const createResult = await service.create(['https://error.com']);
      const stored = await service.getOne(createResult.id);

      expect(stored.results[0].error).toBe('Connection refused');
      expect(stored.results[0].statusCode).toBeNull();
    });

    it('should store mixed success and error results', async () => {
      const results = [
        createMockFetchResult('https://success.com'),
        createMockFetchResult('https://error.com', {
          error: 'Timeout',
          statusCode: null,
        }),
      ];
      urlFetcherService.fetchMany.mockResolvedValue(results);

      const createResult = await service.create(['https://success.com', 'https://error.com']);
      const stored = await service.getOne(createResult.id);

      expect(stored.results[0].statusCode).toBe(200);
      expect(stored.results[1].error).toBe('Timeout');
    });
  });

  describe('getOne', () => {
    it('should return stored request by id', async () => {
      urlFetcherService.fetchMany.mockResolvedValue([
        createMockFetchResult('https://example.com'),
      ]);

      const createResult = await service.create(['https://example.com']);
      const getResult = await service.getOne(createResult.id);

      expect(getResult.id).toBe(createResult.id);
    });

    it('should throw NotFoundException for non-existent id', async () => {
      await expect(service.getOne('non-existent-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should include id in error message', async () => {
      await expect(service.getOne('req_12345')).rejects.toThrow(
        'Request not req_12345 found',
      );
    });

    it('should return complete structure', async () => {
      const urls = ['https://example.com'];
      const mockResult = createMockFetchResult('https://example.com', {
        finalUrl: 'https://example.com/',
        contentType: 'text/html; charset=utf-8',
      });
      urlFetcherService.fetchMany.mockResolvedValue([mockResult]);

      const createResult = await service.create(urls);
      const stored = await service.getOne(createResult.id);

      expect(stored).toEqual({
        id: createResult.id,
        createdAt: expect.any(Number),
        urls: ['https://example.com'],
        results: [
          {
            url: 'https://example.com',
            finalUrl: 'https://example.com/',
            statusCode: 200,
            contentType: 'text/html; charset=utf-8',
            content: '<html>test</html>',
            error: null,
          },
        ],
      });
    });

    it('should allow multiple retrieves of same request', async () => {
      urlFetcherService.fetchMany.mockResolvedValue([
        createMockFetchResult('https://example.com'),
      ]);

      const createResult = await service.create(['https://example.com']);
      
      const get1 = await service.getOne(createResult.id);
      const get2 = await service.getOne(createResult.id);

      expect(get1).toEqual(get2);
    });
  });

  describe('isolation between requests', () => {
    it('should store multiple requests independently', async () => {
      urlFetcherService.fetchMany
        .mockResolvedValueOnce([createMockFetchResult('https://first.com')])
        .mockResolvedValueOnce([createMockFetchResult('https://second.com')]);

      const result1 = await service.create(['https://first.com']);
      
      // Small delay to ensure different timestamp/ID
      await new Promise(resolve => setTimeout(resolve, 5));
      
      const result2 = await service.create(['https://second.com']);

      // Verify different IDs
      expect(result1.id).not.toBe(result2.id);

      const stored1 = await service.getOne(result1.id);
      const stored2 = await service.getOne(result2.id);

      expect(stored1.urls).toEqual(['https://first.com']);
      expect(stored2.urls).toEqual(['https://second.com']);
    });
  });
});
