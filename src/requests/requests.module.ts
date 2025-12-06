import { Module } from "@nestjs/common";
import { RequestsController } from "./requests.controller";
import { RequestsService } from "./requests.service";
import { UrlFetcherService } from "./url-fetcher.service";
import { SecurityModule } from "src/security/security.module";
import { SsrfPolicyService } from "src/security/policy/ssrf-policy.service";

@Module({
    imports: [SecurityModule],
    controllers: [RequestsController],
    providers: [RequestsService, UrlFetcherService, SsrfPolicyService],
})
export class RequestsModule {}