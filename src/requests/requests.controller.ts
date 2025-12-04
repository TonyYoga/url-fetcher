import { Body, Controller, Post, Get, Param } from "@nestjs/common";
import { CreateRequestDto } from "./dto/create-requests.dto";


interface MockRequestResult {
    id: string;
    createdAt: Date;
    urls: string[];
}

@Controller('requests')
export class RequestComtroller {
    private readonly mockStore = new Map<string, MockRequestResult>();
    @Post('create')
    createRequest(@Body() createRequestDto: CreateRequestDto) {

        const { urls } = createRequestDto;

        const id = `req_${Date.now()}`;

        const record: MockRequestResult = {
            id,
            createdAt: new Date(),
            urls,
        }

        this.mockStore.set(id, record);


        return {
            id: record.id,
            createdAt: record.createdAt,
            urls: record.urls,
        }
    }   

    @Get(':id')
    async getOne(@Param('id') id: string) {
        const record = this.mockStore.get(id);
        if (!record) {
            return {
                error: `Request not found: ${id}`,
            }
        }
        return record;
    }
}