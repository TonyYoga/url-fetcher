import { Injectable, Logger } from "@nestjs/common";
import { UrlFetchResult } from "./models/request-result.model";
import axios from "axios";
import { HTTP_TIMEOUT_MS, MAX_CONTENT_LENGTH_BYTES, MAX_REDIRECTS } from "src/common/constants";
import { ensurePublicHttpUrl } from "src/common/ssrf.util";
import { SecureHttpClient } from "src/security/http/secure-http.clents";

@Injectable()
export class UrlFetcherService {
    private readonly logger = new Logger(UrlFetcherService.name);

    constructor(private readonly secureHttpClient: SecureHttpClient) { }

    async fetchOne(url: string): Promise<UrlFetchResult> {
        try {
            //check if url is a public http url
            const response = await this.secureHttpClient.get(url, {
                timeout: HTTP_TIMEOUT_MS,
                maxRedirects: MAX_REDIRECTS, //definiton
                responseType: 'arraybuffer',
                maxContentLength: MAX_CONTENT_LENGTH_BYTES,
                validateStatus: () => true,
            });
            //fallback to original url if final url is not set
            const finalUrl = (response.request && response.request.res && response.request.res.responseUrl)
                ? response.request.res.responseUrl
                : url;
            const contentType = response.headers['content-type'] ?? null;

            let content: string | null = null;
            try {
                const buffer = response.data as Buffer;
                content = buffer.toString('utf-8');
            } catch (error) {
                this.logger.error(`Error parsing content for URL: ${url}`, error);
                content = null;
            }

            return {
                url,
                finalUrl,
                statusCode: response.status ?? null,
                contentType,
                content,
                error: null,
            };
        } catch (error) {
            this.logger.error(`Error fetching URL: ${url}`, error);
            return {
                url,
                finalUrl: null,
                statusCode: null,
                contentType: null,
                content: null,
                error: error.message,
            };
        }
    }

    async fetchMany(urls: string[]): Promise<UrlFetchResult[]> {
        const promises = urls.map(url => this.fetchOne(url));
        const results = await Promise.all(promises);
        return results;
    }
}