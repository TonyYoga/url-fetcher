import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { SsrfPolicyService } from "../policy/ssrf-policy.service";

@Injectable()
export class SsrfGuard implements CanActivate {
    constructor(private readonly ssrfPolicy: SsrfPolicyService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const urls = request.body?.urls

        if (!urls) {
            throw new ForbiddenException('No URLs provided');
        }

        const listOfUrls: string[] = Array.isArray(urls) ? urls : [urls];

        for (const rawUrl of listOfUrls) {
            if (typeof rawUrl !== 'string') continue;
      
            await this.ssrfPolicy.validateUrlOrThrow(rawUrl);
          }
      
          return true;
    }
}