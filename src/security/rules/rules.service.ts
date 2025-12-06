import { Inject, Injectable } from "@nestjs/common";
import { SECURITY_RULES_CONFIG } from "./rules.provider";

export interface SsrRulesConfig {
    allowedHosts: string[];
    blockedIpRanges: string[];
    maxRedirects: number;
    allowedProtocols: string[];
    maxResponseSizeBytes: number;
    validateRedirectChain: boolean;
}

export interface SecurityRules {
    ssrf: SsrRulesConfig;
}
// here logic can be updated to manage multiple rulesets
@Injectable()
export class SecurityRulesService {

 constructor( @Inject(SECURITY_RULES_CONFIG)private readonly rules: SecurityRules){}

 getSsrRules(): SsrRulesConfig {
    return this.rules.ssrf;
 }

 getSecurityRules(): SecurityRules {
    return this.rules;
 }
}