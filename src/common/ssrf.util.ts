import * as dns from 'node:dns';
import { URL } from 'node:url';

const lookupAsync = dns.promises.lookup;

// Private IPv4 ranges (RFC1918 + loopback + link-local)

const PRIVATE_IPV4_RANGES = [
    { from: '10.0.0.0', to: '10.255.255.255' }, //RFC1918
    { from: '172.16.0.0', to: '172.31.255.255' }, //RFC1918
    { from: '192.168.0.0', to: '192.168.255.255' }, //RFC1918
    { from: '127.0.0.0', to: '127.255.255.255' }, //loopback
    { from: '169.254.0.0', to: '169.254.255.255' }, //link-local
  ];

  function ipv4ToInt(ip: string): number {
    const parts = ip.split('.').map(Number);
    if(parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
        throw new Error(`Invalid IPv4 address: ${ip}`);
    }
    return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
}

function isPrivateIpv4(ip: string): boolean {
    try{
        const intIp = ipv4ToInt(ip);
        return PRIVATE_IPV4_RANGES.some(range => {
            const fromInt = ipv4ToInt(range.from);
            const toInt = ipv4ToInt(range.to);
            return intIp >= fromInt && intIp <= toInt;
        });
    } catch (error) {
        return false;
    }
}

function validateSchema(urlObj: URL): void {
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        throw new Error(`Invalid protocol: ${urlObj.protocol}`);
    }
    if (urlObj.hostname.includes(' ')) {
        throw new Error(`Invalid hostname: ${urlObj.hostname}`);
    }
}

export async function ensurePublicHttpUrl(rawUrl: string): Promise<void> {
    let urlObj: URL;
    try {
        urlObj = new URL(rawUrl);
    } catch (error) {
        throw new Error(`Invalid URL: ${rawUrl}`);
    }
    validateSchema(urlObj);
    
    const hostname = urlObj.hostname;

    const { address, family } = await lookupAsync(hostname);
    if (family === 4 && isPrivateIpv4(address)) {
        throw new Error(`Private IP address: ${address}`);
    }
    
    if (family === 6) {
        if (address === '::1' || address.toLowerCase().startsWith('fe80:')) {
            throw new Error(`Private or internal IPv6 address is not allowed: ${address}`);
        }
    }
}

