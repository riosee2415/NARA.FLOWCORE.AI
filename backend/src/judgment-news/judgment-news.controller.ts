import { Controller, Get } from '@nestjs/common';
import {
  JudgmentNewsService,
  JudgmentNewsArticle,
} from './judgment-news.service';

@Controller('judgment-news')
export class JudgmentNewsController {
  constructor(private readonly judgmentNewsService: JudgmentNewsService) {}

  /**
   * 판결기사 수동 크롤링 + DB 저장 테스트 엔드포인트
   * - 항상 1페이지만 처리
   */
  @Get('manual')
  async manualCrawl(): Promise<JudgmentNewsArticle[]> {
    const articles = await this.judgmentNewsService.crawlRecent();
    const dbStats = await this.judgmentNewsService.saveArticlesToDb(articles);

    // 콘솔에 AI 스타일 요약 로그 출력
    // (타이틀만 노출)
    // eslint-disable-next-line no-console
    console.log(
      '[LawTimes-판결][HTTP/manual] AI가 최신 판결기사를 정리했습니다.',
    );
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          pageMode: 'single',
          count: articles.length,
          titles: articles.map((a) => a.title),
          dbStats,
        },
        null,
        2,
      ),
    );

    return articles;
  }

  /**
   * 판결기사 전용: 최신 1페이지 크롤링 + 저장만 요약 반환
   */
  @Get('syncRecent')
  async syncRecent(): Promise<{
    total: number;
    created: number;
    skipped: number;
  }> {
    const stats = await this.judgmentNewsService.crawlAndSaveRecent();

    // eslint-disable-next-line no-console
    console.log(
      '[LawTimes-판결][HTTP/syncRecent] AI가 판결기사 DB 동기화를 완료했습니다.',
    );
    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify(
        {
          total: stats.total,
          created: stats.created,
          skipped: stats.skipped,
        },
        null,
        2,
      ),
    );

    return stats;
  }
}
