import { Module } from "@nestjs/common";
import { RequestComtroller } from "./requests.controller";

@Module({
    imports: [],
    controllers: [RequestComtroller],
})
export class RequestsModule {}