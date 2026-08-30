import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

// Standalone process for BullMQ consumers (blueprint §27 QUEUE
// ARCHITECTURE). No HTTP listener — it shares AppModule so it gets the
// same DI graph (Prisma, config) as the API process. Job processors land
// with docs/backlog/sprint-backlog.md Sprint 6 (event automation) and
// Sprint 11 (notifications/shipping); until then this just keeps the
// process alive so `docker compose up worker` is a real, working command
// from day one rather than a TODO.
async function bootstrap() {
  const logger = new Logger('Worker');
  await NestFactory.createApplicationContext(AppModule);
  logger.log('Worker process started, waiting for jobs...');
}
bootstrap();
