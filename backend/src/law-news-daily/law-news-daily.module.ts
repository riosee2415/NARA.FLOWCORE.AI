import { Module } from '@nestjs/common';
import { LawTimesModule } from '../lawtimes/lawtimes.module';
import { JudgmentNewsModule } from '../judgment-news/judgment-news.module';
import { LtnModule } from '../ltn/ltn.module';
import { ProcurementModule } from '../procurement/procurement.module';
import { LawNewsDailyService } from './law-news-daily.service';
import { LawNewsDailyController } from './law-news-daily.controller';

@Module({
  imports: [LawTimesModule, JudgmentNewsModule, LtnModule, ProcurementModule],
  controllers: [LawNewsDailyController],
  providers: [LawNewsDailyService],
})
export class LawNewsDailyModule {}
