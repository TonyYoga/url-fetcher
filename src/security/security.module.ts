import { Module } from "@nestjs/common";
import { SsrfPolicyService } from "./policy/ssrf-policy.service";
import { SsrfGuard } from "./guards/ssrf.guard";
import { securityRulesProvider } from "./rules/rules.provider";
import { SecureHttpClient } from "./http/secure-http.clents";
import { SecurityRulesService } from "./rules/rules.service";

@Module({
    imports: [],
    providers: [
        ...securityRulesProvider, 
        SsrfPolicyService, 
        SsrfGuard,
        SecureHttpClient,
        SecurityRulesService,
    ],
    exports: [SecureHttpClient, SsrfGuard, SecurityRulesService],
})
export class SecurityModule {}