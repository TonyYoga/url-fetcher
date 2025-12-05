import * as dns from 'node:dns';
import { ensurePublicHttpUrl } from './ssrf.util';

jest.mock('node:dns', () => ({
  promises: {
    lookup: jest.fn(),
  },
}));

const mockLookup = dns.promises.lookup as jest.MockedFunction<
  typeof dns.promises.lookup
>;

describe('ssrf.util', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensurePublicHttpUrl', () => {
    describe('URL parsing', () => {
      it('should throw for invalid URL format', async () => {
        await expect(ensurePublicHttpUrl('not-a-url')).rejects.toThrow(
          'Invalid URL: not-a-url',
        );
      });

      it('should throw for empty string', async () => {
        await expect(ensurePublicHttpUrl('')).rejects.toThrow('Invalid URL: ');
      });

      it('should throw for URL without protocol', async () => {
        await expect(ensurePublicHttpUrl('example.com')).rejects.toThrow(
          'Invalid URL: example.com',
        );
      });
    });

    describe('protocol validation', () => {
      it('should accept http protocol', async () => {
        mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

        await expect(
          ensurePublicHttpUrl('http://example.com'),
        ).resolves.toBeUndefined();
      });

      it('should accept https protocol', async () => {
        mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

        await expect(
          ensurePublicHttpUrl('https://example.com'),
        ).resolves.toBeUndefined();
      });

      it('should reject ftp protocol', async () => {
        await expect(
          ensurePublicHttpUrl('ftp://example.com'),
        ).rejects.toThrow('Invalid protocol: ftp:');
      });

      it('should reject file protocol', async () => {
        await expect(
          ensurePublicHttpUrl('file:///etc/passwd'),
        ).rejects.toThrow('Invalid protocol: file:');
      });

      it('should reject javascript protocol', async () => {
        await expect(
          ensurePublicHttpUrl('javascript:alert(1)'),
        ).rejects.toThrow('Invalid protocol: javascript:');
      });

      it('should reject data protocol', async () => {
        await expect(
          ensurePublicHttpUrl('data:text/html,<h1>Hello</h1>'),
        ).rejects.toThrow('Invalid protocol: data:');
      });
    });

    describe('private IPv4 ranges', () => {
      describe('10.0.0.0/8 (RFC1918)', () => {
        it('should reject 10.0.0.0', async () => {
          mockLookup.mockResolvedValue({ address: '10.0.0.0', family: 4 });

          await expect(
            ensurePublicHttpUrl('http://internal.example.com'),
          ).rejects.toThrow('Private IP address: 10.0.0.0');
        });

        it('should reject 10.0.0.1', async () => {
          mockLookup.mockResolvedValue({ address: '10.0.0.1', family: 4 });

          await expect(
            ensurePublicHttpUrl('http://internal.example.com'),
          ).rejects.toThrow('Private IP address: 10.0.0.1');
        });

        it('should reject 10.255.255.255', async () => {
          mockLookup.mockResolvedValue({ address: '10.255.255.255', family: 4 });

          await expect(
            ensurePublicHttpUrl('http://internal.example.com'),
          ).rejects.toThrow('Private IP address: 10.255.255.255');
        });

        it('should reject 10.128.0.1 (middle of range)', async () => {
          mockLookup.mockResolvedValue({ address: '10.128.0.1', family: 4 });

          await expect(
            ensurePublicHttpUrl('http://internal.example.com'),
          ).rejects.toThrow('Private IP address: 10.128.0.1');
        });
      });

      describe('172.16.0.0/12 (RFC1918)', () => {
        it('should reject 172.16.0.0', async () => {
          mockLookup.mockResolvedValue({ address: '172.16.0.0', family: 4 });

          await expect(
            ensurePublicHttpUrl('http://internal.example.com'),
          ).rejects.toThrow('Private IP address: 172.16.0.0');
        });

        it('should reject 172.31.255.255', async () => {
          mockLookup.mockResolvedValue({ address: '172.31.255.255', family: 4 });

          await expect(
            ensurePublicHttpUrl('http://internal.example.com'),
          ).rejects.toThrow('Private IP address: 172.31.255.255');
        });

        it('should reject 172.20.0.1 (middle of range)', async () => {
          mockLookup.mockResolvedValue({ address: '172.20.0.1', family: 4 });

          await expect(
            ensurePublicHttpUrl('http://internal.example.com'),
          ).rejects.toThrow('Private IP address: 172.20.0.1');
        });

        it('should allow 172.15.255.255 (just before range)', async () => {
          mockLookup.mockResolvedValue({ address: '172.15.255.255', family: 4 });

          await expect(
            ensurePublicHttpUrl('http://example.com'),
          ).resolves.toBeUndefined();
        });

        it('should allow 172.32.0.0 (just after range)', async () => {
          mockLookup.mockResolvedValue({ address: '172.32.0.0', family: 4 });

          await expect(
            ensurePublicHttpUrl('http://example.com'),
          ).resolves.toBeUndefined();
        });
      });

      describe('192.168.0.0/16 (RFC1918)', () => {
        it('should reject 192.168.0.0', async () => {
          mockLookup.mockResolvedValue({ address: '192.168.0.0', family: 4 });

          await expect(
            ensurePublicHttpUrl('http://internal.example.com'),
          ).rejects.toThrow('Private IP address: 192.168.0.0');
        });

        it('should reject 192.168.255.255', async () => {
          mockLookup.mockResolvedValue({ address: '192.168.255.255', family: 4 });

          await expect(
            ensurePublicHttpUrl('http://internal.example.com'),
          ).rejects.toThrow('Private IP address: 192.168.255.255');
        });

        it('should reject 192.168.1.1 (common router IP)', async () => {
          mockLookup.mockResolvedValue({ address: '192.168.1.1', family: 4 });

          await expect(
            ensurePublicHttpUrl('http://internal.example.com'),
          ).rejects.toThrow('Private IP address: 192.168.1.1');
        });

        it('should allow 192.167.255.255 (just before range)', async () => {
          mockLookup.mockResolvedValue({ address: '192.167.255.255', family: 4 });

          await expect(
            ensurePublicHttpUrl('http://example.com'),
          ).resolves.toBeUndefined();
        });

        it('should allow 192.169.0.0 (just after range)', async () => {
          mockLookup.mockResolvedValue({ address: '192.169.0.0', family: 4 });

          await expect(
            ensurePublicHttpUrl('http://example.com'),
          ).resolves.toBeUndefined();
        });
      });

      describe('127.0.0.0/8 (loopback)', () => {
        it('should reject 127.0.0.0', async () => {
          mockLookup.mockResolvedValue({ address: '127.0.0.0', family: 4 });

          await expect(
            ensurePublicHttpUrl('http://localhost'),
          ).rejects.toThrow('Private IP address: 127.0.0.0');
        });

        it('should reject 127.0.0.1 (localhost)', async () => {
          mockLookup.mockResolvedValue({ address: '127.0.0.1', family: 4 });

          await expect(
            ensurePublicHttpUrl('http://localhost'),
          ).rejects.toThrow('Private IP address: 127.0.0.1');
        });

        it('should reject 127.255.255.255', async () => {
          mockLookup.mockResolvedValue({ address: '127.255.255.255', family: 4 });

          await expect(
            ensurePublicHttpUrl('http://localhost'),
          ).rejects.toThrow('Private IP address: 127.255.255.255');
        });
      });

      describe('169.254.0.0/16 (link-local)', () => {
        it('should reject 169.254.0.0', async () => {
          mockLookup.mockResolvedValue({ address: '169.254.0.0', family: 4 });

          await expect(
            ensurePublicHttpUrl('http://link-local.example.com'),
          ).rejects.toThrow('Private IP address: 169.254.0.0');
        });

        it('should reject 169.254.255.255', async () => {
          mockLookup.mockResolvedValue({ address: '169.254.255.255', family: 4 });

          await expect(
            ensurePublicHttpUrl('http://link-local.example.com'),
          ).rejects.toThrow('Private IP address: 169.254.255.255');
        });

        it('should reject 169.254.169.254 (AWS metadata)', async () => {
          mockLookup.mockResolvedValue({ address: '169.254.169.254', family: 4 });

          await expect(
            ensurePublicHttpUrl('http://metadata.aws.example.com'),
          ).rejects.toThrow('Private IP address: 169.254.169.254');
        });
      });
    });

    describe('public IPv4 addresses', () => {
      it('should allow Google DNS (8.8.8.8)', async () => {
        mockLookup.mockResolvedValue({ address: '8.8.8.8', family: 4 });

        await expect(
          ensurePublicHttpUrl('http://dns.google'),
        ).resolves.toBeUndefined();
      });

      it('should allow Cloudflare DNS (1.1.1.1)', async () => {
        mockLookup.mockResolvedValue({ address: '1.1.1.1', family: 4 });

        await expect(
          ensurePublicHttpUrl('http://cloudflare.com'),
        ).resolves.toBeUndefined();
      });

      it('should allow example.com IP', async () => {
        mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

        await expect(
          ensurePublicHttpUrl('http://example.com'),
        ).resolves.toBeUndefined();
      });

      it('should allow 0.0.0.0', async () => {
        mockLookup.mockResolvedValue({ address: '0.0.0.0', family: 4 });

        await expect(
          ensurePublicHttpUrl('http://zero.example.com'),
        ).resolves.toBeUndefined();
      });

      it('should allow 255.255.255.255', async () => {
        mockLookup.mockResolvedValue({ address: '255.255.255.255', family: 4 });

        await expect(
          ensurePublicHttpUrl('http://broadcast.example.com'),
        ).resolves.toBeUndefined();
      });
    });

    describe('IPv6 addresses', () => {
      it('should reject IPv6 loopback (::1)', async () => {
        mockLookup.mockResolvedValue({ address: '::1', family: 6 });

        await expect(
          ensurePublicHttpUrl('http://localhost'),
        ).rejects.toThrow('Private or internal IPv6 address is not allowed: ::1');
      });

      it('should reject IPv6 link-local (fe80::)', async () => {
        mockLookup.mockResolvedValue({ address: 'fe80::1', family: 6 });

        await expect(
          ensurePublicHttpUrl('http://link-local.example.com'),
        ).rejects.toThrow(
          'Private or internal IPv6 address is not allowed: fe80::1',
        );
      });

      it('should reject IPv6 link-local with uppercase (FE80::)', async () => {
        mockLookup.mockResolvedValue({ address: 'FE80::1', family: 6 });

        await expect(
          ensurePublicHttpUrl('http://link-local.example.com'),
        ).rejects.toThrow(
          'Private or internal IPv6 address is not allowed: FE80::1',
        );
      });

      it('should allow public IPv6 address', async () => {
        mockLookup.mockResolvedValue({
          address: '2607:f8b0:4004:800::200e',
          family: 6,
        });

        await expect(
          ensurePublicHttpUrl('http://ipv6.google.com'),
        ).resolves.toBeUndefined();
      });

      it('should allow IPv6 address starting with 2001:', async () => {
        mockLookup.mockResolvedValue({
          address: '2001:4860:4860::8888',
          family: 6,
        });

        await expect(
          ensurePublicHttpUrl('http://dns.google'),
        ).resolves.toBeUndefined();
      });
    });

    describe('URL with ports and paths', () => {
      it('should accept URL with port', async () => {
        mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

        await expect(
          ensurePublicHttpUrl('http://example.com:8080'),
        ).resolves.toBeUndefined();
      });

      it('should accept URL with path', async () => {
        mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

        await expect(
          ensurePublicHttpUrl('http://example.com/path/to/resource'),
        ).resolves.toBeUndefined();
      });

      it('should accept URL with query string', async () => {
        mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

        await expect(
          ensurePublicHttpUrl('http://example.com?query=value'),
        ).resolves.toBeUndefined();
      });

      it('should accept URL with fragment', async () => {
        mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

        await expect(
          ensurePublicHttpUrl('http://example.com#section'),
        ).resolves.toBeUndefined();
      });

      it('should accept complex URL', async () => {
        mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

        await expect(
          ensurePublicHttpUrl(
            'https://example.com:443/path?query=value#section',
          ),
        ).resolves.toBeUndefined();
      });
    });

    describe('DNS resolution errors', () => {
      it('should propagate DNS resolution errors', async () => {
        const dnsError = new Error('getaddrinfo ENOTFOUND nonexistent.invalid');
        mockLookup.mockRejectedValue(dnsError);

        await expect(
          ensurePublicHttpUrl('http://nonexistent.invalid'),
        ).rejects.toThrow('getaddrinfo ENOTFOUND nonexistent.invalid');
      });
    });

    describe('hostname validation', () => {
      it('should accept valid hostname', async () => {
        mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 });

        await expect(
          ensurePublicHttpUrl('http://valid-hostname.example.com'),
        ).resolves.toBeUndefined();
      });

      it('should accept IP address as hostname', async () => {
        mockLookup.mockResolvedValue({ address: '8.8.8.8', family: 4 });

        await expect(
          ensurePublicHttpUrl('http://8.8.8.8'),
        ).resolves.toBeUndefined();
      });
    });
  });
});
