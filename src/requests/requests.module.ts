import { Module } from "@nestjs/common";
import { RequestsController } from "./requests.controller";
import { RequestsService } from "./requests.service";
import { UrlFetcherService } from "./url-fetcher.service";

@Module({
    imports: [],
    controllers: [RequestsController],
    providers: [RequestsService, UrlFetcherService],
})
export class RequestsModule {}