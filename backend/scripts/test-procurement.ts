/**
 * 조달 사전규격 + 본공고 최근 1개월 전체 조회 테스트
 * 실행: npm run test:procurement
 */
import { NestFactory } from '@nestjs/core';
import { TestPreSpecModule } from './test-pre-spec.module';
import { ProcurementPreSpecService } from '../src/procurement/procurement-pre-spec.service';

async function main() {
  process.env.PROCUREMENT_RUN = 'both';
  const app = await NestFactory.createApplicationContext(TestPreSpecModule, {
    logger: ['log', 'warn', 'error'],
  });
  const service = app.get(ProcurementPreSpecService);
  await service.run();
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
