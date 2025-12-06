export function normalizeIPv4(ip: string): string | null {
    try {
      // 1. If integer (e.g. 2130706433 → 127.0.0.1)
      if (/^\d+$/.test(ip)) {
        const num = Number(ip);
        if (num > 0 && num < 0xFFFFFFFF) {
          return [
            (num >>> 24) & 255,
            (num >>> 16) & 255,
            (num >>> 8) & 255,
            num & 255,
          ].join('.');
        }
      }
  
      // 2. If hex (e.g. 0x7f000001)
      if (ip.startsWith('0x')) {
        const num = parseInt(ip, 16);
        return [
          (num >>> 24) & 255,
          (num >>> 16) & 255,
          (num >>> 8) & 255,
          num & 255,
        ].join('.');
      }
  
      // 3. If octal
      if (ip.startsWith('0') && ip !== '0') {
        const num = parseInt(ip, 8);
        return [
          (num >>> 24) & 255,
          (num >>> 16) & 255,
          (num >>> 8) & 255,
          num & 255,
        ].join('.');
      }
  
      // 4. Normal IPv4
      const parts = ip.split('.');
      if (parts.length === 4) {
        const mapped = parts.map(p => Number(p));
        if (mapped.every(n => n >= 0 && n <= 255)) {
          return mapped.join('.');
        }
      }
  
      return null;
    } catch {
      return null;
    }
  }

  export function isIpv4InCidr(ip: string, cidr: string): boolean {
    const [range, bits] = cidr.split('/');
    const maskBits = Number(bits);
  
    const ipNorm = normalizeIPv4(ip);
    const rangeNorm = normalizeIPv4(range);
    if (!ipNorm || !rangeNorm) return false;
  
    const ipNum = ipNorm.split('.').reduce((acc, o) => (acc << 8) + Number(o), 0);
    const rangeNum = rangeNorm.split('.').reduce((acc, o) => (acc << 8) + Number(o), 0);
  
    const mask = maskBits === 0 ? 0 : (~0 << (32 - maskBits)) >>> 0;
  
    return (ipNum & mask) === (rangeNum & mask);
  }

  export function isIPv6(ip: string): boolean {
    return ip.includes(':');
  }
  
  export function isIPv6InCidr(ip: string, cidr: string): boolean {
    const [range, bitsStr] = cidr.split('/');
    const bits = Number(bitsStr);
  
    // Simple IPv6 normalization
    // Expand ::
    const expand = (v: string) => {
      const parts = v.split(':');
      const emptyIndex = parts.indexOf('');
      if (emptyIndex !== -1) {
        const missing = 8 - (parts.length - 1);
        const zeros = Array(missing).fill('0');
        parts.splice(emptyIndex, 1, ...zeros);
      }
      return parts.map(p => parseInt(p || '0', 16));
    };
  
    try {
      const ipParts = expand(ip);
      const rangeParts = expand(range);
  
      // Compare first "bits" bits
      let matchedBits = 0;
      for (let i = 0; i < 8; i++) {
        const diff = ipParts[i] ^ rangeParts[i];
        if (diff === 0) {
          matchedBits += 16;
          continue;
        }
        // count leading zero bits
        matchedBits += 16 - Math.floor(Math.log2(diff)) - 1;
        break;
      }
      return matchedBits >= bits;
    } catch {
      return false;
    }
  }