import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { JudgmentNewsService } from './judgment-news.service';
import { JudgmentNewsController } from './judgment-news.controller';

@Module({
  imports: [PrismaModule],
  controllers: [JudgmentNewsController],
  providers: [JudgmentNewsService],
  exports: [JudgmentNewsService],
})
export class JudgmentNewsModule {}
