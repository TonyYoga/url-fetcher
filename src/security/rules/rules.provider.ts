import { Provider } from "@nestjs/common";
import { SecurityRules } from "./rules.service";

export const SECURITY_RULES_CONFIG = 'SECURITY_RULES_CONFIG';

const securityRulesConfig: SecurityRules = {
    ssrf: {
        allowedHosts: ['*'],
        blockedIpRanges: [
            // IPv4 PRIVATE
            '127.0.0.1/8',
            '10.0.0.0/8',
            '172.16.0.0/12',
            '192.168.0.0/16',
            // IPv4 LINK-LOCAL
            '169.254.0.0/16',
            // IPv4 MULTICAST
            '224.0.0.0/4',
            // IPv6 LOOPBACK
            '::1/128',
            // IPv6 LINK-LOCAL FE80::/10
            'fe80::/10',
            // IPv6 UNIQUE-LOCAL FC00::/7
            'fc00::/7'
        ],
        maxRedirects: 5,
        validateRedirectChain: true,
        allowedProtocols: ['http:', 'https:'],
        maxResponseSizeBytes: 1024 * 1024 * 5,
        //port blocking
    }
}

export const securityRulesProvider: Provider<SecurityRules>[] = [
    {
        provide: SECURITY_RULES_CONFIG,
        useValue: securityRulesConfig,
    }
]