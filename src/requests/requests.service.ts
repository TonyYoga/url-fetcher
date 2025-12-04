import { Injectable, NotFoundException } from "@nestjs/common";
import { UrlFetcherService } from "./url-fetcher.service";
import { RequestResult } from "./models/request-result.model";

@Injectable()
export class RequestsService {
    private readonly store = new Map<string, RequestResult>();

    constructor(private readonly urlFetcherService: UrlFetcherService) {}

    async create(urls: string[]){
        const id = `req_${Date.now()}`;
        const createdAt = Date.now();

        const results = await this.urlFetcherService.fetchMany(urls);

        const record: RequestResult = {
            id,
            createdAt,
            urls,
            results,
        }
        this.store.set(id, record);


        return {
            id: record.id,
            createdAt: record.createdAt,
            count: record.urls.length,
        };
    }

    async getOne(id: string) {
        const record = this.store.get(id);

        if (!record) {
            throw new NotFoundException(`Request not ${id} found`);
        }

        return record;
    }
}