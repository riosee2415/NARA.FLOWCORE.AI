import { Controller, Get, Query } from '@nestjs/common';
import { LtnService, LtnArticle } from './ltn.service';

@Controller('ltn')
export class LtnController {
  constructor(private readonly ltnService: LtnService) {}

  /**
   * 테스트용 수동 크롤링
   * 예) GET /api/ltn/manual?pages=3
   */
  @Get('manual')
  async manualCrawl(
    @Query('pages') pages: string = '3',
  ): Promise<LtnArticle[]> {
    const n = Number(pages) || 3;
    const result = await this.ltnService.crawlRecent(n);
    await this.ltnService.saveArticlesToDb(result);
    return result;
  }

  /**
   * 크롤링 + DB 저장 한 번에
   * 예) GET /api/ltn/syncRecent?pages=3
   */
  @Get('syncRecent')
  async syncRecent(
    @Query('pages') pages: string = '3',
  ): Promise<{ total: number; created: number; skipped: number }> {
    const n = Number(pages) || 3;
    return this.ltnService.crawlAndSaveRecent(n);
  }
}
