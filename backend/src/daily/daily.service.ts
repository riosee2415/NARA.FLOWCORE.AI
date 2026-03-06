import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DAILY_TASKS } from './daily.constants';
import type { DailyTask } from './daily-task.interface';

@Injectable()
export class DailyService {
  private readonly logger = new Logger(DailyService.name);

  constructor(
    @Optional()
    @Inject(DAILY_TASKS)
    private readonly tasks: DailyTask[] = [],
  ) {}

  /**
   * 매일 오전 8시 30분(KST)에 등록된 모든 DailyTask 순차 실행
   */
  @Cron('30 8 * * *', { timeZone: 'Asia/Seoul' })
  async handleDailyMorning() {
    if (this.tasks.length === 0) {
      this.logger.log('등록된 아침 작업 없음');
      return;
    }
    this.logger.log(`아침 작업 시작 (총 ${this.tasks.length}개)`);
    for (const task of this.tasks) {
      try {
        await task.run();
        this.logger.log(`[${task.name}] 완료`);
      } catch (err) {
        this.logger.error(
          `[${task.name}] 실패: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    this.logger.log('아침 작업 종료');
  }
}
