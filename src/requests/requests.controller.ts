import { Body, Controller, Post, Get, Param } from "@nestjs/common";
import { CreateRequestDto } from "./dto/create-requests.dto";
import { RequestsService } from "./requests.service";

@Controller('requests')
export class RequestsController {
    constructor(private readonly requestsService: RequestsService) {}

    @Post('create')
    async createRequest(@Body() createRequestDto: CreateRequestDto) {

        const { urls } = createRequestDto;
        return this.requestsService.create(urls);
    }   

    @Get(':id')
    async getOne(@Param('id') id: string) {
        return this.requestsService.getOne(id);
    }
}