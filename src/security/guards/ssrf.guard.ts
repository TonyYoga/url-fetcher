import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { SsrfPolicyService } from '../policy/ssrf-policy.service';
import { AppLogger } from 'src/common/logger/app-logger.service';

@Injectable()
export class SsrfGuard implements CanActivate {
  private readonly logger = AppLogger.create(SsrfGuard.name);

  constructor(private readonly ssrfPolicy: SsrfPolicyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const urls = request.body?.urls;

    if (!urls) {
      this.logger.warn('No URLs provided in request', {
        event: 'guard_no_urls',
      });
      throw new ForbiddenException('No URLs provided');
    }

    const listOfUrls: string[] = Array.isArray(urls) ? urls : [urls];

    this.logger.debug('Validating URLs', {
      event: 'guard_validate_start',
      urlCount: listOfUrls.length,
    });

    for (const rawUrl of listOfUrls) {
      if (typeof rawUrl !== 'string') continue;

      await this.ssrfPolicy.validateUrlOrThrow(rawUrl);
    }

    this.logger.debug('All URLs validated successfully', {
      event: 'guard_validate_success',
      urlCount: listOfUrls.length,
    });

    return true;
  }
}
