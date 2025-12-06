import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { AppLogger } from './common/logger/app-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Use custom logger
  const logger = AppLogger.create('Application');
  app.useLogger(logger);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  
  logger.info('Application started', {
    event: 'app_start',
    port: Number(port),
    nodeEnv: process.env.NODE_ENV || 'development',
  });
}
bootstrap();
