import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId: string;
  startTime: number;
  clientIp?: string;
  method?: string;
  path?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}

export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
