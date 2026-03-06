/**
 * 매일 아침(8:30) 크론에서 실행할 작업 인터페이스.
 * 새 작업 추가 시 이 인터페이스를 구현하고 DAILY_TASKS 멀티 프로바이더로 등록하면 됨.
 */
export interface DailyTask {
  readonly name: string;
  run(): Promise<void>;
}
