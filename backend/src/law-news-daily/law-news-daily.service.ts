import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReportMailerService } from '../procurement/report-mailer.service';
import { LawTimesService } from '../lawtimes/lawtimes.service';
import { JudgmentNewsService } from '../judgment-news/judgment-news.service';
import { LtnService } from '../ltn/ltn.service';

/**
 * 매일 오전 10시·오후 5시 법원 뉴스 + 판결기사 + 법률방송뉴스 크롤링 후 DB 동기화 및 보고 메일 발송
 */
@Injectable()
export class LawNewsDailyService {
  private readonly logger = new Logger(LawNewsDailyService.name);

  constructor(
    private readonly lawTimesService: LawTimesService,
    private readonly judgmentNewsService: JudgmentNewsService,
    private readonly ltnService: LtnService,
    private readonly reportMailer: ReportMailerService,
  ) {}

  /**
   * 세 크롤러(법원 뉴스·판결기사·법률방송뉴스) 실행 후 결과를 모아 이메일 발송 (크론·수동 공통)
   */
  async runDailyJob(): Promise<void> {
    const runAt = new Date().toLocaleString('ko-KR', {
      timeZone: 'Asia/Seoul',
    });

    this.logger.log(
      `[LawNewsDaily] 크론 실행 — 법원 뉴스·판결기사·법률방송뉴스 수집 및 메일 발송 시작 (${runAt})`,
    );

    const [legalStats, judgmentStats, ltnStats] = await Promise.all([
      this.lawTimesService.crawlAndSaveRecent(3),
      this.judgmentNewsService.crawlAndSaveRecent(),
      this.ltnService.crawlAndSaveRecent(3),
    ]);

    const sent = await this.reportMailer.sendLawNewsReport({
      runAt,
      legal: {
        total: legalStats.total,
        created: legalStats.created,
        skipped: legalStats.skipped,
        newTitles: legalStats.newTitles,
      },
      judgment: {
        total: judgmentStats.total,
        created: judgmentStats.created,
        skipped: judgmentStats.skipped,
        newTitles: judgmentStats.newTitles,
      },
      ltn: {
        total: ltnStats.total,
        created: ltnStats.created,
        skipped: ltnStats.skipped,
        newTitles: ltnStats.newTitles,
      },
    });

    if (sent) {
      this.logger.log(
        `[LawNewsDaily] 보고 메일 발송 완료 — 법원 ${legalStats.created}건, 판결 ${judgmentStats.created}건, 법률방송뉴스 ${ltnStats.created}건 신규`,
      );
    } else {
      this.logger.warn('[LawNewsDaily] 보고 메일 발송 스킵 또는 실패');
    }
  }

  @Cron('0 10 * * *', { timeZone: 'Asia/Seoul' })
  async handle10am(): Promise<void> {
    await this.runDailyJob();
  }

  @Cron('0 17 * * *', { timeZone: 'Asia/Seoul' })
  async handle5pm(): Promise<void> {
    await this.runDailyJob();
  }
}
