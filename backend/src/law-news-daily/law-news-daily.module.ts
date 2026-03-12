import { Module } from '@nestjs/common';
import { LawTimesModule } from '../lawtimes/lawtimes.module';
import { JudgmentNewsModule } from '../judgment-news/judgment-news.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { LawNewsDailyService } from './law-news-daily.service';
import { LawNewsDailyController } from './law-news-daily.controller';

@Module({
  imports: [LawTimesModule, JudgmentNewsModule, ProcurementModule],
  controllers: [LawNewsDailyController],
  providers: [LawNewsDailyService],
})
export class LawNewsDailyModule {}
