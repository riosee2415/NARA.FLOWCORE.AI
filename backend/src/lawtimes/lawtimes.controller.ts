import { Controller, Get, Query } from '@nestjs/common';
import { LawTimesService, LawTimesArticle } from './lawtimes.service';

@Controller('lawtimes')
export class LawTimesController {
  constructor(private readonly lawTimesService: LawTimesService) {}

  /**
   * 테스트용 수동 크롤링 엔드포인트
   * 예) GET /api/lawtimes/manual?pages=3
   */
  @Get('manual')
  async manualCrawl(
    @Query('pages') pages: string = '3',
  ): Promise<LawTimesArticle[]> {
    const n = Number(pages) || 3;
    const result = await this.lawTimesService.crawlRecent(n);
    const stats = await this.lawTimesService.saveArticlesToDb(result);

    console.log('\n[LawTimes-AI] ====== 수동 크롤링 + 저장 요약 ======');
    const titles = result.map((item) => item.title);
    console.log(
      JSON.stringify(
        {
          pages: n,
          count: result.length,
          titles,
          dbStats: stats,
        },
        null,
        2,
      ),
    );
    console.log('[LawTimes-AI] ====== 끝 ======\n');

    return result;
  }

  /**
   * 크롤링 + DB 저장까지 한 번에 수행하는 엔드포인트
   * 예) GET /api/lawtimes/syncRecent?pages=3
   */
  @Get('syncRecent')
  async syncRecent(
    @Query('pages') pages: string = '3',
  ): Promise<{ total: number; created: number; skipped: number }> {
    const n = Number(pages) || 3;
    const stats = await this.lawTimesService.crawlAndSaveRecent(n);

    console.log('\n[LawTimes-AI] ====== 크롤 + 저장 결과 요약 ======');
    console.log(JSON.stringify({ pages: n, ...stats }, null, 2));
    console.log('[LawTimes-AI] ====== 끝 ======\n');

    return stats;
  }
}
