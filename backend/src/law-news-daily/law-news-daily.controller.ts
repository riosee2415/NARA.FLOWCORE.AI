import { Controller, Get } from '@nestjs/common';
import { LawNewsDailyService } from './law-news-daily.service';

/**
 * 수동 실행: 크롤링 + DB 동기화 + 보고 메일 발송 (크론과 동일한 흐름)
 * GET /api/law-news-daily/run
 */
@Controller('law-news-daily')
export class LawNewsDailyController {
  constructor(private readonly lawNewsDailyService: LawNewsDailyService) {}

  @Get('run')
  async runManually(): Promise<{ message: string }> {
    await this.lawNewsDailyService.runDailyJob();
    return {
      message:
        '법원 뉴스·판결기사 수집, DB 동기화, 보고 메일 발송을 완료했습니다.',
    };
  }
}
