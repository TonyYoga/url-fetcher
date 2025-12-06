import { Body, Controller, Post, Get, Param, UseGuards } from "@nestjs/common";
import { CreateRequestDto } from "./dto/create-requests.dto";
import { RequestsService } from "./requests.service";
import { SsrfGuard } from "src/security/guards/ssrf.guard";

@Controller('requests')
export class RequestsController {
    constructor(private readonly requestsService: RequestsService) {}

    @Post('create')
    @UseGuards(SsrfGuard)
    async createRequest(@Body() createRequestDto: CreateRequestDto) {

        const { urls } = createRequestDto;
        return this.requestsService.create(urls);
    }   

    @Get(':id')
    async getOne(@Param('id') id: string) {
        return this.requestsService.getOne(id);
    }
}