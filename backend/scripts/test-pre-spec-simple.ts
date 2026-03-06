/**
 * 사전규격 "최근 1달 기준 최신 10개" 심플 테스트
 * 실행: npm run test:pre-spec:simple
 */
import { NestFactory } from '@nestjs/core';
import { TestPreSpecModule } from './test-pre-spec.module';
import { ProcurementPreSpecService } from '../src/procurement/procurement-pre-spec.service';

async function main() {
  const app = await NestFactory.createApplicationContext(TestPreSpecModule, {
    logger: ['log', 'warn', 'error'],
  });

  const service = app.get(ProcurementPreSpecService);
  const limit = Number(process.env.PRE_SPEC_LATEST_LIMIT ?? '10') || 10;

  console.log(`=== 사전규격 최근 1달 최신 ${limit}개 심플 테스트 ===\n`);
  const items = await service.fetchPreSpecLatest(limit);
  console.log(JSON.stringify(items, null, 2));
  console.log('\n=== 테스트 종료 ===');

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
