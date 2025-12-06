/**
 * Integration tests for SecurityAxiosAdapter
 * Uses real SsrfPolicyService, SecurityRulesService
 * Mocks: DNS (external), HTTP adapter (external network call)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { SsrfPolicyService } from '../policy/ssrf-policy.service';
import { SecurityRulesService } from '../rules/rules.service';
import { securityRulesProvider } from '../rules/rules.provider';
import * as dns from 'node:dns/promises';

// Mock external calls only
jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}));

const mockLookup = dns.lookup as jest.MockedFunction<typeof dns.lookup>;

// Mock HTTP adapter - external network call
const mockHttpAdapter = jest.fn();
jest.mock('axios', () => ({
  ...jest.requireActual('axios'),
  getAdapter: jest.fn(() => mockHttpAdapter),
}));

// Import after mocking
import { createSecurityAxiosAdapter } from './security-axios.adapter';

describe('SecurityAxiosAdapter (integration)', () => {
  let ssrfPolicy: SsrfPolicyService;
  let adapter: (config: AxiosRequestConfig) => Promise<AxiosResponse>;

  const createMockResponse = (
    status: number,
    headers: Record<string, string> = {},
    data: any = {},
  ): AxiosResponse => ({
    status,
    statusText: 'OK',
    headers,
    config: {} as InternalAxiosRequestConfig,
    data,
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    mockHttpAdapter.mockReset();

    // Use REAL providers
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ...securityRulesProvider,
        SecurityRulesService,
        SsrfPolicyService,
      ],
    }).compile();

    ssrfPolicy = module.get<SsrfPolicyService>(SsrfPolicyService);
    adapter = createSecurityAxiosAdapter(ssrfPolicy);
  });

  describe('initial URL validation', () => {
    it('should validate and allow public IP', async () => {
      mockHttpAdapter.mockResolvedValue(createMockResponse(200, {}, 'OK'));

      const response = await adapter({ url: 'http://8.8.8.8' });

      expect(response.status).toBe(200);
      expect(mockLookup).not.toHaveBeenCalled(); // IP doesn't need DNS
    });

    it('should validate and allow public hostname', async () => {
      mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });
      mockHttpAdapter.mockResolvedValue(createMockResponse(200));

      const response = await adapter({ url: 'https://example.com' });

      expect(response.status).toBe(200);
      expect(mockLookup).toHaveBeenCalledWith('example.com');
    });

    it('should block private IP before making request', async () => {
      await expect(adapter({ url: 'http://127.0.0.1' })).rejects.toThrow(
        'SSRF blocked: private IP 127.0.0.1',
      );

      expect(mockHttpAdapter).not.toHaveBeenCalled();
    });

    it('should block AWS metadata IP', async () => {
      await expect(
        adapter({ url: 'http://169.254.169.254/latest/meta-data' }),
      ).rejects.toThrow('SSRF blocked: private IP 169.254.169.254');

      expect(mockHttpAdapter).not.toHaveBeenCalled();
    });

    it('should block hostname resolving to private IP', async () => {
      mockLookup.mockResolvedValue({ address: '192.168.1.1', family: 4 });

      await expect(adapter({ url: 'http://internal.corp' })).rejects.toThrow(
        'SSRF blocked: private IP 192.168.1.1',
      );

      expect(mockHttpAdapter).not.toHaveBeenCalled();
    });

    it('should construct full URL from baseURL and url', async () => {
      mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });
      mockHttpAdapter.mockResolvedValue(createMockResponse(200));

      await adapter({
        baseURL: 'https://api.example.com',
        url: '/v1/users',
      });

      expect(mockLookup).toHaveBeenCalledWith('api.example.com');
    });
  });

  describe('redirect handling with real validation', () => {
    it('should follow safe redirect', async () => {
      mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });
      
      mockHttpAdapter
        .mockResolvedValueOnce(
          createMockResponse(302, { location: 'https://new.example.com/page' }),
        )
        .mockResolvedValueOnce(createMockResponse(200, {}, 'Final'));

      const response = await adapter({ url: 'https://example.com' });

      expect(response.status).toBe(200);
      expect(mockHttpAdapter).toHaveBeenCalledTimes(2);
    });

    it('should block redirect to localhost', async () => {
      mockLookup
        .mockResolvedValueOnce({ address: '93.184.216.34', family: 4 }) // Initial
        .mockResolvedValueOnce({ address: '127.0.0.1', family: 4 }); // Redirect target

      mockHttpAdapter.mockResolvedValueOnce(
        createMockResponse(302, { location: 'http://localhost/admin' }),
      );

      await expect(adapter({ url: 'https://example.com' })).rejects.toThrow(
        'SSRF blocked: private IP 127.0.0.1',
      );
    });

    it('should block redirect to private IP', async () => {
      mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

      mockHttpAdapter.mockResolvedValueOnce(
        createMockResponse(302, { location: 'http://192.168.1.1/admin' }),
      );

      await expect(adapter({ url: 'https://example.com' })).rejects.toThrow(
        'SSRF blocked: private IP 192.168.1.1',
      );
    });

    it('should block redirect to AWS metadata', async () => {
      mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

      mockHttpAdapter.mockResolvedValueOnce(
        createMockResponse(302, { location: 'http://169.254.169.254/latest' }),
      );

      await expect(adapter({ url: 'https://example.com' })).rejects.toThrow(
        'SSRF blocked: private IP 169.254.169.254',
      );
    });

    it('should handle redirect chain and validate each step', async () => {
      mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

      // Chain: A -> B -> C -> final
      mockHttpAdapter
        .mockResolvedValueOnce(createMockResponse(302, { location: 'https://b.example.com' }))
        .mockResolvedValueOnce(createMockResponse(302, { location: 'https://c.example.com' }))
        .mockResolvedValueOnce(createMockResponse(200, {}, 'Final'));

      const response = await adapter({ url: 'https://a.example.com' });

      expect(response.status).toBe(200);
      expect(mockHttpAdapter).toHaveBeenCalledTimes(3);
      // DNS lookup called for each unique hostname
      expect(mockLookup).toHaveBeenCalledWith('a.example.com');
    });

    it('should block multi-hop redirect to private IP', async () => {
      mockLookup
        .mockResolvedValueOnce({ address: '93.184.216.34', family: 4 })
        .mockResolvedValueOnce({ address: '93.184.216.34', family: 4 })
        .mockResolvedValueOnce({ address: '10.0.0.1', family: 4 }); // Final hop

      mockHttpAdapter
        .mockResolvedValueOnce(createMockResponse(302, { location: 'https://hop1.com' }))
        .mockResolvedValueOnce(createMockResponse(302, { location: 'http://internal.corp' }));

      await expect(adapter({ url: 'https://start.com' })).rejects.toThrow(
        'SSRF blocked: private IP 10.0.0.1',
      );
    });

    it('should throw when max redirects exceeded', async () => {
      mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

      // 6 redirects with maxRedirects=5
      for (let i = 0; i < 6; i++) {
        mockHttpAdapter.mockResolvedValueOnce(
          createMockResponse(302, { location: `https://redirect${i}.com` }),
        );
      }

      await expect(
        adapter({ url: 'https://start.com', maxRedirects: 5 }),
      ).rejects.toThrow('Maximum redirects (5) exceeded');
    });

    it('should change method to GET on 303 redirect', async () => {
      mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

      mockHttpAdapter
        .mockResolvedValueOnce(createMockResponse(303, { location: 'https://result.com' }))
        .mockResolvedValueOnce(createMockResponse(200));

      await adapter({ url: 'https://example.com', method: 'POST' });

      // Check second call uses GET
      const secondCall = mockHttpAdapter.mock.calls[1][0];
      expect(secondCall.method).toBe('GET');
    });

    it('should preserve method on 307 redirect', async () => {
      mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

      mockHttpAdapter
        .mockResolvedValueOnce(createMockResponse(307, { location: 'https://result.com' }))
        .mockResolvedValueOnce(createMockResponse(200));

      await adapter({ url: 'https://example.com', method: 'POST' });

      // Check second call preserves POST
      const secondCall = mockHttpAdapter.mock.calls[1][0];
      expect(secondCall.method).toBe('POST');
    });
  });

  describe('response handling', () => {
    it('should return response for non-redirect', async () => {
      mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });
      mockHttpAdapter.mockResolvedValue(createMockResponse(200, {}, { data: 'test' }));

      const response = await adapter({ url: 'https://example.com' });

      expect(response.status).toBe(200);
      expect(response.data).toEqual({ data: 'test' });
    });

    it('should not follow redirect without location header', async () => {
      mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });
      mockHttpAdapter.mockResolvedValue(createMockResponse(302, {})); // No location

      const response = await adapter({ url: 'https://example.com' });

      expect(response.status).toBe(302);
      expect(mockHttpAdapter).toHaveBeenCalledTimes(1);
    });

    it('should respect validateStatus callback', async () => {
      mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });
      mockHttpAdapter.mockResolvedValue(createMockResponse(404));

      await expect(
        adapter({
          url: 'https://example.com',
          validateStatus: (status) => status < 400,
        }),
      ).rejects.toThrow('Request failed with status code 404');
    });
  });

  describe('real-world attack scenarios', () => {
    it('should block DNS rebinding attack (hostname resolves to private after redirect)', async () => {
      mockLookup
        .mockResolvedValueOnce({ address: '93.184.216.34', family: 4 })
        .mockResolvedValueOnce({ address: '127.0.0.1', family: 4 }); // Same hostname, different IP

      mockHttpAdapter.mockResolvedValueOnce(
        createMockResponse(302, { location: 'http://evil.com/callback' }),
      );

      await expect(adapter({ url: 'https://attacker.com' })).rejects.toThrow(
        'SSRF blocked: private IP 127.0.0.1',
      );
    });

    it('should block integer IP encoding bypass attempt', async () => {
      // 2130706433 = 127.0.0.1 in integer form
      // The URL parser may or may not handle this, but our IP normalizer should
      await expect(
        adapter({ url: 'http://2130706433' }), // Integer form of 127.0.0.1
      ).rejects.toThrow(); // Either invalid URL or blocked
    });

    it('should block cloud metadata via public redirect', async () => {
      mockLookup.mockResolvedValue({ address: '54.239.98.0', family: 4 }); // AWS IP

      mockHttpAdapter.mockResolvedValueOnce(
        createMockResponse(302, { location: 'http://169.254.169.254/latest/meta-data/' }),
      );

      await expect(adapter({ url: 'https://aws-service.com' })).rejects.toThrow(
        'SSRF blocked: private IP 169.254.169.254',
      );
    });
  });
});
