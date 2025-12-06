/**
 * Unit tests for IP normalization utilities
 * No mocks needed - pure functions
 */
import {
  normalizeIPv4,
  isIpv4InCidr,
  isIPv6,
  isIPv6InCidr,
} from './normalize-ip.utils';

describe('normalize-ip.utils', () => {
  describe('normalizeIPv4', () => {
    describe('standard dotted-decimal format', () => {
      it('should return same IP for valid standard format', () => {
        expect(normalizeIPv4('192.168.1.1')).toBe('192.168.1.1');
      });

      it('should normalize IP with leading zeros in octets', () => {
        expect(normalizeIPv4('192.168.001.001')).toBe('192.168.1.1');
      });

      it('should handle 0.0.0.0', () => {
        expect(normalizeIPv4('0.0.0.0')).toBe('0.0.0.0');
      });

      it('should handle 255.255.255.255', () => {
        expect(normalizeIPv4('255.255.255.255')).toBe('255.255.255.255');
      });

      it('should handle localhost 127.0.0.1', () => {
        expect(normalizeIPv4('127.0.0.1')).toBe('127.0.0.1');
      });
    });

    describe('integer format (decimal)', () => {
      it('should convert 2130706433 to 127.0.0.1', () => {
        expect(normalizeIPv4('2130706433')).toBe('127.0.0.1');
      });

      it('should convert 3232235777 to 192.168.1.1', () => {
        expect(normalizeIPv4('3232235777')).toBe('192.168.1.1');
      });

      it('should convert 167772161 to 10.0.0.1', () => {
        expect(normalizeIPv4('167772161')).toBe('10.0.0.1');
      });

      it('should convert 1 to 0.0.0.1', () => {
        expect(normalizeIPv4('1')).toBe('0.0.0.1');
      });
    });

    describe('hexadecimal format', () => {
      it('should convert 0x7f000001 to 127.0.0.1', () => {
        expect(normalizeIPv4('0x7f000001')).toBe('127.0.0.1');
      });

      it('should convert 0xC0A80101 to 192.168.1.1', () => {
        expect(normalizeIPv4('0xC0A80101')).toBe('192.168.1.1');
      });

      it('should convert 0x0A000001 to 10.0.0.1', () => {
        expect(normalizeIPv4('0x0A000001')).toBe('10.0.0.1');
      });
    });

    describe('octal format', () => {
      it('should convert octal 017700000001 to 127.0.0.1', () => {
        expect(normalizeIPv4('017700000001')).toBe('127.0.0.1');
      });
    });

    describe('invalid inputs', () => {
      it('should return null for empty string', () => {
        expect(normalizeIPv4('')).toBeNull();
      });

      it('should return null for invalid IP with 5 octets', () => {
        expect(normalizeIPv4('192.168.1.1.1')).toBeNull();
      });

      it('should return null for invalid IP with 3 octets', () => {
        expect(normalizeIPv4('192.168.1')).toBeNull();
      });

      it('should return null for IP with octet > 255', () => {
        expect(normalizeIPv4('192.168.1.256')).toBeNull();
      });

      it('should return null for IP with negative octet', () => {
        expect(normalizeIPv4('192.168.1.-1')).toBeNull();
      });

      it('should return null for non-numeric string', () => {
        expect(normalizeIPv4('not.an.ip.address')).toBeNull();
      });

      it('should return null for IPv6 address', () => {
        expect(normalizeIPv4('::1')).toBeNull();
      });
    });
  });

  describe('isIpv4InCidr', () => {
    describe('private ranges (RFC1918)', () => {
      describe('10.0.0.0/8', () => {
        const cidr = '10.0.0.0/8';

        it('should match 10.0.0.0', () => {
          expect(isIpv4InCidr('10.0.0.0', cidr)).toBe(true);
        });

        it('should match 10.0.0.1', () => {
          expect(isIpv4InCidr('10.0.0.1', cidr)).toBe(true);
        });

        it('should match 10.255.255.255', () => {
          expect(isIpv4InCidr('10.255.255.255', cidr)).toBe(true);
        });

        it('should NOT match 11.0.0.0', () => {
          expect(isIpv4InCidr('11.0.0.0', cidr)).toBe(false);
        });

        it('should NOT match 9.255.255.255', () => {
          expect(isIpv4InCidr('9.255.255.255', cidr)).toBe(false);
        });
      });

      describe('172.16.0.0/12', () => {
        const cidr = '172.16.0.0/12';

        it('should match 172.16.0.0', () => {
          expect(isIpv4InCidr('172.16.0.0', cidr)).toBe(true);
        });

        it('should match 172.31.255.255', () => {
          expect(isIpv4InCidr('172.31.255.255', cidr)).toBe(true);
        });

        it('should NOT match 172.15.255.255', () => {
          expect(isIpv4InCidr('172.15.255.255', cidr)).toBe(false);
        });

        it('should NOT match 172.32.0.0', () => {
          expect(isIpv4InCidr('172.32.0.0', cidr)).toBe(false);
        });
      });

      describe('192.168.0.0/16', () => {
        const cidr = '192.168.0.0/16';

        it('should match 192.168.0.0', () => {
          expect(isIpv4InCidr('192.168.0.0', cidr)).toBe(true);
        });

        it('should match 192.168.255.255', () => {
          expect(isIpv4InCidr('192.168.255.255', cidr)).toBe(true);
        });

        it('should NOT match 192.167.255.255', () => {
          expect(isIpv4InCidr('192.167.255.255', cidr)).toBe(false);
        });

        it('should NOT match 192.169.0.0', () => {
          expect(isIpv4InCidr('192.169.0.0', cidr)).toBe(false);
        });
      });
    });

    describe('loopback 127.0.0.0/8', () => {
      const cidr = '127.0.0.1/8';

      it('should match 127.0.0.1', () => {
        expect(isIpv4InCidr('127.0.0.1', cidr)).toBe(true);
      });

      it('should match 127.255.255.255', () => {
        expect(isIpv4InCidr('127.255.255.255', cidr)).toBe(true);
      });

      it('should NOT match 128.0.0.0', () => {
        expect(isIpv4InCidr('128.0.0.0', cidr)).toBe(false);
      });
    });

    describe('link-local 169.254.0.0/16 (AWS metadata)', () => {
      const cidr = '169.254.0.0/16';

      it('should match 169.254.169.254 (AWS metadata)', () => {
        expect(isIpv4InCidr('169.254.169.254', cidr)).toBe(true);
      });

      it('should NOT match 169.253.255.255', () => {
        expect(isIpv4InCidr('169.253.255.255', cidr)).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle /32 mask (single IP)', () => {
        expect(isIpv4InCidr('192.168.1.1', '192.168.1.1/32')).toBe(true);
        expect(isIpv4InCidr('192.168.1.2', '192.168.1.1/32')).toBe(false);
      });

      it('should handle /0 mask (all IPs)', () => {
        expect(isIpv4InCidr('1.2.3.4', '0.0.0.0/0')).toBe(true);
      });

      it('should return false for invalid IP', () => {
        expect(isIpv4InCidr('invalid', '10.0.0.0/8')).toBe(false);
      });

      it('should handle integer IP format in CIDR check', () => {
        expect(isIpv4InCidr('2130706433', '127.0.0.0/8')).toBe(true);
      });

      it('should handle hex IP format in CIDR check', () => {
        expect(isIpv4InCidr('0x7f000001', '127.0.0.0/8')).toBe(true);
      });
    });
  });

  describe('isIPv6', () => {
    it('should return true for ::1', () => {
      expect(isIPv6('::1')).toBe(true);
    });

    it('should return true for full IPv6 address', () => {
      expect(isIPv6('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
    });

    it('should return true for compressed IPv6', () => {
      expect(isIPv6('2001:db8::1')).toBe(true);
    });

    it('should return true for link-local fe80::', () => {
      expect(isIPv6('fe80::1')).toBe(true);
    });

    it('should return false for IPv4', () => {
      expect(isIPv6('192.168.1.1')).toBe(false);
    });

    it('should return false for integer IP', () => {
      expect(isIPv6('2130706433')).toBe(false);
    });
  });

  describe('isIPv6InCidr', () => {
    describe('loopback ::1/128', () => {
      it('should match ::1', () => {
        expect(isIPv6InCidr('::1', '::1/128')).toBe(true);
      });

      it('should NOT match ::2', () => {
        expect(isIPv6InCidr('::2', '::1/128')).toBe(false);
      });
    });

    describe('link-local fe80::/10', () => {
      const cidr = 'fe80::/10';

      it('should match fe80::1', () => {
        expect(isIPv6InCidr('fe80::1', cidr)).toBe(true);
      });

      it('should match fe80::abcd:1234', () => {
        expect(isIPv6InCidr('fe80::abcd:1234', cidr)).toBe(true);
      });

      it('should NOT match 2001:db8::1', () => {
        expect(isIPv6InCidr('2001:db8::1', cidr)).toBe(false);
      });
    });

    describe('unique-local fc00::/7', () => {
      const cidr = 'fc00::/7';

      it('should match fc00::1', () => {
        expect(isIPv6InCidr('fc00::1', cidr)).toBe(true);
      });

      it('should match fd00::1', () => {
        expect(isIPv6InCidr('fd00::1', cidr)).toBe(true);
      });

      it('should NOT match fe00::1', () => {
        expect(isIPv6InCidr('fe00::1', cidr)).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should return false for invalid IPv6', () => {
        expect(isIPv6InCidr('invalid', '::1/128')).toBe(false);
      });
    });
  });
});
