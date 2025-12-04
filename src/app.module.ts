import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RequestsModule } from './requests/requests.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    RequestsModule,
  ],
})
export class AppModule {}
