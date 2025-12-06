/**
 * Integration tests for SsrfPolicyService
 * Uses real SecurityRulesService with real config
 * Only mocks: DNS resolution (external network call)
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { SsrfPolicyService } from './ssrf-policy.service';
import { SecurityRulesService } from '../rules/rules.service';
import { securityRulesProvider } from '../rules/rules.provider';
import * as dns from 'node:dns/promises';

// Only mock DNS - it's an external network call
jest.mock('node:dns/promises', () => ({
  lookup: jest.fn(),
}));

const mockLookup = dns.lookup as jest.MockedFunction<typeof dns.lookup>;

describe('SsrfPolicyService (integration)', () => {
  let service: SsrfPolicyService;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Use REAL providers - no mocking of internal services
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ...securityRulesProvider,  // Real config provider
        SecurityRulesService,       // Real rules service
        SsrfPolicyService,          // Real policy service
      ],
    }).compile();

    service = module.get<SsrfPolicyService>(SsrfPolicyService);
  });

  describe('validateUrlOrThrow', () => {
    describe('URL parsing', () => {
      it('should throw for invalid URL', async () => {
        await expect(service.validateUrlOrThrow('not-a-url')).rejects.toThrow(
          ForbiddenException,
        );
        await expect(service.validateUrlOrThrow('not-a-url')).rejects.toThrow(
          'Invalid URL: not-a-url',
        );
      });

      it('should throw for empty string', async () => {
        await expect(service.validateUrlOrThrow('')).rejects.toThrow(
          ForbiddenException,
        );
      });

      it('should throw for URL without protocol', async () => {
        await expect(service.validateUrlOrThrow('example.com')).rejects.toThrow(
          ForbiddenException,
        );
      });
    });

    describe('DNS resolution', () => {
      it('should skip DNS lookup for IP addresses (uses IP directly)', async () => {
        // When URL contains IP, DNS lookup should NOT be called
        await expect(
          service.validateUrlOrThrow('http://8.8.8.8'),
        ).resolves.toBeUndefined();

        expect(mockLookup).not.toHaveBeenCalled();
      });

      it('should perform DNS lookup for hostnames', async () => {
        mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

        await service.validateUrlOrThrow('https://example.com');

        expect(mockLookup).toHaveBeenCalledWith('example.com');
      });

      it('should throw when DNS resolution fails', async () => {
        mockLookup.mockRejectedValue(new Error('ENOTFOUND'));

        await expect(
          service.validateUrlOrThrow('https://nonexistent.invalid'),
        ).rejects.toThrow('DNS resolution failed for host: nonexistent.invalid');
      });
    });

    describe('IPv4 private ranges blocking (real config)', () => {
      describe('loopback 127.0.0.0/8', () => {
        it('should block 127.0.0.1 via hostname', async () => {
          mockLookup.mockResolvedValue({ address: '127.0.0.1', family: 4 });

          await expect(
            service.validateUrlOrThrow('http://localhost'),
          ).rejects.toThrow('SSRF blocked: private IP 127.0.0.1');
        });

        it('should block 127.0.0.1 as direct IP (no DNS lookup)', async () => {
          await expect(
            service.validateUrlOrThrow('http://127.0.0.1'),
          ).rejects.toThrow('SSRF blocked: private IP 127.0.0.1');

          expect(mockLookup).not.toHaveBeenCalled();
        });

        it('should block any 127.x.x.x address', async () => {
          await expect(
            service.validateUrlOrThrow('http://127.255.255.255'),
          ).rejects.toThrow('SSRF blocked: private IP 127.255.255.255');
        });
      });

      describe('private 10.0.0.0/8', () => {
        it('should block 10.0.0.1', async () => {
          await expect(
            service.validateUrlOrThrow('http://10.0.0.1'),
          ).rejects.toThrow('SSRF blocked: private IP 10.0.0.1');
        });

        it('should block 10.255.255.255', async () => {
          await expect(
            service.validateUrlOrThrow('http://10.255.255.255'),
          ).rejects.toThrow('SSRF blocked: private IP 10.255.255.255');
        });

        it('should block hostname resolving to 10.x.x.x', async () => {
          mockLookup.mockResolvedValue({ address: '10.0.0.1', family: 4 });

          await expect(
            service.validateUrlOrThrow('http://internal.corp'),
          ).rejects.toThrow('SSRF blocked: private IP 10.0.0.1');
        });
      });

      describe('private 172.16.0.0/12', () => {
        it('should block 172.16.0.1', async () => {
          await expect(
            service.validateUrlOrThrow('http://172.16.0.1'),
          ).rejects.toThrow('SSRF blocked: private IP 172.16.0.1');
        });

        it('should block 172.31.255.255', async () => {
          await expect(
            service.validateUrlOrThrow('http://172.31.255.255'),
          ).rejects.toThrow('SSRF blocked: private IP 172.31.255.255');
        });

        it('should allow 172.32.0.0 (outside range)', async () => {
          await expect(
            service.validateUrlOrThrow('http://172.32.0.0'),
          ).resolves.toBeUndefined();
        });

        it('should allow 172.15.255.255 (outside range)', async () => {
          await expect(
            service.validateUrlOrThrow('http://172.15.255.255'),
          ).resolves.toBeUndefined();
        });
      });

      describe('private 192.168.0.0/16', () => {
        it('should block 192.168.1.1', async () => {
          await expect(
            service.validateUrlOrThrow('http://192.168.1.1'),
          ).rejects.toThrow('SSRF blocked: private IP 192.168.1.1');
        });

        it('should block 192.168.0.1', async () => {
          await expect(
            service.validateUrlOrThrow('http://192.168.0.1'),
          ).rejects.toThrow('SSRF blocked: private IP 192.168.0.1');
        });

        it('should allow 192.169.0.0 (outside range)', async () => {
          await expect(
            service.validateUrlOrThrow('http://192.169.0.0'),
          ).resolves.toBeUndefined();
        });
      });

      describe('link-local 169.254.0.0/16 (cloud metadata)', () => {
        it('should block 169.254.169.254 (AWS/GCP metadata)', async () => {
          await expect(
            service.validateUrlOrThrow('http://169.254.169.254/latest/meta-data'),
          ).rejects.toThrow('SSRF blocked: private IP 169.254.169.254');
        });

        it('should block any 169.254.x.x', async () => {
          await expect(
            service.validateUrlOrThrow('http://169.254.0.1'),
          ).rejects.toThrow('SSRF blocked: private IP 169.254.0.1');
        });
      });

      describe('multicast 224.0.0.0/4', () => {
        it('should block 224.0.0.1', async () => {
          await expect(
            service.validateUrlOrThrow('http://224.0.0.1'),
          ).rejects.toThrow('SSRF blocked: private IP 224.0.0.1');
        });

        it('should block 239.255.255.255', async () => {
          await expect(
            service.validateUrlOrThrow('http://239.255.255.255'),
          ).rejects.toThrow('SSRF blocked: private IP 239.255.255.255');
        });
      });
    });

    describe('IPv6 private ranges blocking (real config)', () => {
      it('should block ::1 (loopback)', async () => {
        mockLookup.mockResolvedValue({ address: '::1', family: 6 });

        await expect(
          service.validateUrlOrThrow('http://ipv6-localhost'),
        ).rejects.toThrow('SSRF blocked: private IP ::1');
      });

      it('should block fe80::1 (link-local)', async () => {
        mockLookup.mockResolvedValue({ address: 'fe80::1', family: 6 });

        await expect(
          service.validateUrlOrThrow('http://link-local.test'),
        ).rejects.toThrow('SSRF blocked: private IP fe80::1');
      });

      it('should block fc00::1 (unique-local)', async () => {
        mockLookup.mockResolvedValue({ address: 'fc00::1', family: 6 });

        await expect(
          service.validateUrlOrThrow('http://private-ipv6.test'),
        ).rejects.toThrow('SSRF blocked: private IP fc00::1');
      });

      it('should block fd00::1 (unique-local)', async () => {
        mockLookup.mockResolvedValue({ address: 'fd00::1', family: 6 });

        await expect(
          service.validateUrlOrThrow('http://private-ipv6.test'),
        ).rejects.toThrow('SSRF blocked: private IP fd00::1');
      });
    });

    describe('public IP addresses (allowed)', () => {
      it('should allow Google DNS 8.8.8.8', async () => {
        await expect(
          service.validateUrlOrThrow('http://8.8.8.8'),
        ).resolves.toBeUndefined();
      });

      it('should allow Cloudflare DNS 1.1.1.1', async () => {
        await expect(
          service.validateUrlOrThrow('http://1.1.1.1'),
        ).resolves.toBeUndefined();
      });

      it('should allow public hostname', async () => {
        mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

        await expect(
          service.validateUrlOrThrow('https://example.com'),
        ).resolves.toBeUndefined();
      });

      it('should allow public IPv6', async () => {
        mockLookup.mockResolvedValue({
          address: '2607:f8b0:4004:800::200e',
          family: 6,
        });

        await expect(
          service.validateUrlOrThrow('http://ipv6.google.com'),
        ).resolves.toBeUndefined();
      });
    });

    describe('URL with ports and paths', () => {
      it('should validate URL with port', async () => {
        mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

        await expect(
          service.validateUrlOrThrow('http://example.com:8080'),
        ).resolves.toBeUndefined();
      });

      it('should validate URL with path', async () => {
        mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

        await expect(
          service.validateUrlOrThrow('http://example.com/api/v1/data'),
        ).resolves.toBeUndefined();
      });

      it('should validate URL with query string', async () => {
        mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

        await expect(
          service.validateUrlOrThrow('http://example.com?foo=bar'),
        ).resolves.toBeUndefined();
      });

      it('should block private IP even with port and path', async () => {
        await expect(
          service.validateUrlOrThrow('http://192.168.1.1:8080/admin'),
        ).rejects.toThrow('SSRF blocked: private IP 192.168.1.1');
      });
    });
  });

  describe('getSecurityRules', () => {
    it('should return real security rules', () => {
      const rules = service.getSecurityRules();

      expect(rules).toHaveProperty('ssrf');
      expect(rules.ssrf.blockedIpRanges).toContain('127.0.0.1/8');
      expect(rules.ssrf.blockedIpRanges).toContain('10.0.0.0/8');
      expect(rules.ssrf.blockedIpRanges).toContain('192.168.0.0/16');
      expect(rules.ssrf.maxRedirects).toBe(5);
    });
  });
});
