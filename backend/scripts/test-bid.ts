/**
 * 본공고(입찰공고)만 조회 테스트 (사전규격 제외)
 * 실행: npm run test:bid
 */
import { NestFactory } from '@nestjs/core';
import { TestPreSpecModule } from './test-pre-spec.module';
import { ProcurementPreSpecService } from '../src/procurement/procurement-pre-spec.service';

async function main() {
  process.env.PROCUREMENT_RUN = 'bid';
  // 본공고 단독 테스트에서는 OpenAI 확장 없이 빠르게 실행
  process.env.PRE_SPEC_USE_AI_EXPAND = 'false';
  const app = await NestFactory.createApplicationContext(TestPreSpecModule, {
    logger: ['log', 'warn', 'error'],
  });
  const service = app.get(ProcurementPreSpecService);
  console.log('=== 본공고만 테스트 (사전규격 제외) ===\n');
  await service.run();
  console.log('\n=== 테스트 종료 ===');
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
