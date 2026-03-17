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
    private readonly tasks: DailyTask[] | DailyTask | undefined = [],
  ) {}

  /**
   * 등록된 모든 DailyTask 순차 실행 (공통)
   */
  private async runAllTasks(label: string): Promise<void> {
    const tasksArray: DailyTask[] = Array.isArray(this.tasks)
      ? this.tasks
      : this.tasks
        ? [this.tasks]
        : [];

    if (tasksArray.length === 0) {
      this.logger.log(`[${label}] 등록된 작업 없음`);
      return;
    }
    this.logger.log(`[${label}] 작업 시작 (총 ${tasksArray.length}개)`);
    for (const task of tasksArray) {
      try {
        await task.run();
        this.logger.log(`[${label}] [${task.name}] 완료`);
      } catch (err) {
        this.logger.error(
          `[${label}] [${task.name}] 실패: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    this.logger.log(`[${label}] 작업 종료`);
  }

  /**
   * 매일 오전 9시(KST) — 조달 수집 등 DailyTask 실행
   */
  @Cron('0 9 * * *', { timeZone: 'Asia/Seoul' })
  async handleDaily9am() {
    await this.runAllTasks('오전 9시');
  }

  /**
   * 매일 오후 3시(KST) — 조달 수집 등 DailyTask 실행
   */
  @Cron('0 15 * * *', { timeZone: 'Asia/Seoul' })
  async handleDaily3pm() {
    await this.runAllTasks('오후 3시');
  }
}
