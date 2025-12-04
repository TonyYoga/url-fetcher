import { Injectable, Logger } from "@nestjs/common";
import { UrlFetchResult } from "./models/request-result.model";
import axios from "axios";

@Injectable()
export class UrlFetcherService {
    private readonly logger = new Logger(UrlFetcherService.name);
    
    constructor() {}

    async fetchOne(url: string): Promise<UrlFetchResult> {
        try {
            const response = await axios.get(url, {
                validateStatus: () => true,
            });
            const contentType = response.headers['content-type'] ?? null;
            const data = response.data;

            const content = typeof data === 'string' ? data : JSON.stringify(data);

            return {
                url,
                finalUrl: url, //todo: add final url
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