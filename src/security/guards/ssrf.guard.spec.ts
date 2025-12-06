/**
 * Integration tests for SsrfGuard
 * Uses real SsrfPolicyService, SecurityRulesService
 * Only mocks: DNS resolution (external network call)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SsrfGuard } from './ssrf.guard';
import { SsrfPolicyService } from '../policy/ssrf-policy.service';
import { SecurityRulesService } from '../rules/rules.service';
import { securityRulesProvider } from '../rules/rules.provider';
import * as dns from 'node:dns/promises';

// Only mock DNS - external network call
jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}));

const mockLookup = dns.lookup as jest.MockedFunction<typeof dns.lookup>;

describe('SsrfGuard (integration)', () => {
  let guard: SsrfGuard;

  const createMockContext = (body: any): ExecutionContext => ({
    switchToHttp: () => ({
      getRequest: () => ({ body }),
    }),
  } as ExecutionContext);

  beforeEach(async () => {
    jest.clearAllMocks();

    // Use REAL providers
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ...securityRulesProvider,
        SecurityRulesService,
        SsrfPolicyService,
        SsrfGuard,
      ],
    }).compile();

    guard = module.get<SsrfGuard>(SsrfGuard);
  });

  describe('canActivate', () => {
    describe('input validation', () => {
      it('should throw when urls is not provided', async () => {
        const context = createMockContext({});

        await expect(guard.canActivate(context)).rejects.toThrow(
          ForbiddenException,
        );
        await expect(guard.canActivate(context)).rejects.toThrow(
          'No URLs provided',
        );
      });

      it('should throw when body is null', async () => {
        const context = createMockContext(null);

        await expect(guard.canActivate(context)).rejects.toThrow(
          'No URLs provided',
        );
      });

      it('should throw when urls is null', async () => {
        const context = createMockContext({ urls: null });

        await expect(guard.canActivate(context)).rejects.toThrow(
          'No URLs provided',
        );
      });
    });

    describe('valid URLs (real validation)', () => {
      it('should allow public IP URL', async () => {
        const context = createMockContext({
          urls: ['http://8.8.8.8'],
        });

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
      });

      it('should allow public hostname (via DNS)', async () => {
        mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

        const context = createMockContext({
          urls: ['https://example.com'],
        });

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
        expect(mockLookup).toHaveBeenCalledWith('example.com');
      });

      it('should validate each URL in array', async () => {
        mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

        const context = createMockContext({
          urls: ['https://example.com', 'http://8.8.8.8'],
        });

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
        // First URL triggers DNS lookup, second is IP so no lookup
        expect(mockLookup).toHaveBeenCalledTimes(1);
      });

      it('should handle single URL as string', async () => {
        const context = createMockContext({
          urls: 'http://8.8.8.8',
        });

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
      });

      it('should skip non-string values in array', async () => {
        const context = createMockContext({
          urls: ['http://8.8.8.8', 123, null, undefined],
        });

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
      });

      it('should handle empty array', async () => {
        const context = createMockContext({ urls: [] });

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
      });
    });

    describe('SSRF blocking (real validation)', () => {
      it('should block localhost', async () => {
        mockLookup.mockResolvedValue({ address: '127.0.0.1', family: 4 });

        const context = createMockContext({
          urls: ['http://localhost'],
        });

        await expect(guard.canActivate(context)).rejects.toThrow(
          'SSRF blocked: private IP 127.0.0.1',
        );
      });

      it('should block 127.0.0.1 directly (no DNS)', async () => {
        const context = createMockContext({
          urls: ['http://127.0.0.1'],
        });

        await expect(guard.canActivate(context)).rejects.toThrow(
          'SSRF blocked: private IP 127.0.0.1',
        );

        expect(mockLookup).not.toHaveBeenCalled();
      });

      it('should block private IP 10.x.x.x', async () => {
        const context = createMockContext({
          urls: ['http://10.0.0.1'],
        });

        await expect(guard.canActivate(context)).rejects.toThrow(
          'SSRF blocked: private IP 10.0.0.1',
        );
      });

      it('should block private IP 192.168.x.x', async () => {
        const context = createMockContext({
          urls: ['http://192.168.1.1'],
        });

        await expect(guard.canActivate(context)).rejects.toThrow(
          'SSRF blocked: private IP 192.168.1.1',
        );
      });

      it('should block AWS metadata IP', async () => {
        const context = createMockContext({
          urls: ['http://169.254.169.254/latest/meta-data'],
        });

        await expect(guard.canActivate(context)).rejects.toThrow(
          'SSRF blocked: private IP 169.254.169.254',
        );
      });

      it('should block if any URL in array is malicious', async () => {
        mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

        const context = createMockContext({
          urls: [
            'https://example.com',  // Valid
            'http://127.0.0.1',     // Invalid
          ],
        });

        await expect(guard.canActivate(context)).rejects.toThrow(
          'SSRF blocked: private IP 127.0.0.1',
        );
      });

      it('should stop at first malicious URL', async () => {
        const context = createMockContext({
          urls: [
            'http://127.0.0.1',      // First - blocked
            'http://192.168.1.1',    // Second - never reached
          ],
        });

        await expect(guard.canActivate(context)).rejects.toThrow(
          'SSRF blocked: private IP 127.0.0.1',
        );
      });

      it('should block invalid URL format', async () => {
        const context = createMockContext({
          urls: ['not-a-valid-url'],
        });

        await expect(guard.canActivate(context)).rejects.toThrow(
          'Invalid URL: not-a-valid-url',
        );
      });

      it('should block when DNS fails', async () => {
        mockLookup.mockRejectedValue(new Error('ENOTFOUND'));

        const context = createMockContext({
          urls: ['http://nonexistent.invalid'],
        });

        await expect(guard.canActivate(context)).rejects.toThrow(
          'DNS resolution failed',
        );
      });
    });

    describe('IPv6 blocking', () => {
      it('should block IPv6 loopback via hostname', async () => {
        mockLookup.mockResolvedValue({ address: '::1', family: 6 });

        const context = createMockContext({
          urls: ['http://ipv6-localhost'],
        });

        await expect(guard.canActivate(context)).rejects.toThrow(
          'SSRF blocked: private IP ::1',
        );
      });

      it('should block IPv6 link-local', async () => {
        mockLookup.mockResolvedValue({ address: 'fe80::1', family: 6 });

        const context = createMockContext({
          urls: ['http://link-local.test'],
        });

        await expect(guard.canActivate(context)).rejects.toThrow(
          'SSRF blocked: private IP fe80::1',
        );
      });
    });
  });
});
