import { ForbiddenException, Injectable } from '@nestjs/common';
import { SecurityRules, SecurityRulesService } from '../rules/rules.service';
import { isIpv4InCidr, isIPv6, isIPv6InCidr, normalizeIPv4 } from 'src/common/normalize-ip.utils';
import { AppLogger } from 'src/common/logger/app-logger.service';
import * as dns from 'node:dns/promises';
import * as net from 'net';

@Injectable()
export class SsrfPolicyService {
  private readonly logger = AppLogger.create(SsrfPolicyService.name);

  constructor(private readonly securityRulesService: SecurityRulesService) {}

  private isPrivateIp(ip: string): boolean {
    const rules = this.securityRulesService.getSsrRules();
    const ranges = rules.blockedIpRanges;

    const isIPv6Ip = isIPv6(ip);
    for (const range of ranges) {
      // Single IP case
      if (!range.includes('/')) {
        if (isIPv6Ip) {
          if (ip.toLowerCase() === range.toLowerCase()) {
            return true;
          }
        } else {
          const normIp = normalizeIPv4(ip);
          const normRange = normalizeIPv4(range);
          if (normIp && normRange && normIp === normRange) {
            return true;
          }
        }
      } else {
        if (isIPv6Ip) {
          if (isIPv6InCidr(ip, range)) {
            return true;
          }
        } else {
          if (isIpv4InCidr(ip, range)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  async validateUrlOrThrow(urlStr: string): Promise<void> {
    const rules = this.securityRulesService.getSsrRules();

    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch {
      throw new ForbiddenException(`Invalid URL: ${urlStr}`);
    }

    const host = parsed.hostname;

    // ALLOWLIST
    if (!rules.allowedHosts.includes('*') && !rules.allowedHosts.includes(host)) {
      this.logger.warn('Host blocked by allowlist', {
        event: 'ssrf_allowlist_blocked',
        host,
        url: urlStr,
      });
      throw new ForbiddenException(`Host not allowed by SSRF policy: ${host}`);
    }

    // Determine the IP address to check
    let address: string;

    // Check if host is already an IP address (skip DNS lookup)
    if (net.isIP(host)) {
      address = host;
      this.logger.debug('Host is IP address', {
        event: 'ssrf_ip_direct',
        host,
      });
    } else {
      // DNS lookup for hostnames
      try {
        const result = await dns.lookup(host);
        address = result.address;
        this.logger.debug('DNS resolved', {
          event: 'ssrf_dns_resolved',
          host,
          resolvedIp: address,
        });
      } catch {
        throw new ForbiddenException(`DNS resolution failed for host: ${host}`);
      }
    }

    if (this.isPrivateIp(address)) {
      this.logger.warn('SSRF attempt blocked', {
        event: 'ssrf_blocked',
        host,
        resolvedIp: address,
        url: urlStr,
        reason: 'private_ip',
      });
      throw new ForbiddenException(
        `SSRF blocked: private IP ${address} for host ${host}`,
      );
    }
  }

  getSecurityRules(): SecurityRules {
    return this.securityRulesService.getSecurityRules();
  }
}
