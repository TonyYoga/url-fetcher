import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { requestContext, RequestContext } from '../context/request-context';
import { randomUUID } from 'crypto';

export const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.headers[REQUEST_ID_HEADER] as string) || randomUUID();
    
    // Set header for response
    req['requestId'] = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    const context: RequestContext = {
      requestId,
      startTime: Date.now(),
      clientIp: req.ip || req.socket.remoteAddress,
      method: req.method,
      path: req.path,
    };

    // Run the rest of the request in the async context
    requestContext.run(context, () => {
      next();
    });
  }
}
