/**
 * 사전규격만 조회 테스트 (본공고 제외)
 * 실행: npm run test:pre-spec
 */
import { NestFactory } from '@nestjs/core';
import { TestPreSpecModule } from './test-pre-spec.module';
import { ProcurementPreSpecService } from '../src/procurement/procurement-pre-spec.service';

async function main() {
  process.env.PROCUREMENT_RUN = 'pre_spec';
  const app = await NestFactory.createApplicationContext(TestPreSpecModule, {
    logger: ['log', 'warn', 'error'],
  });
  const service = app.get(ProcurementPreSpecService);
  console.log('=== 사전규격만 테스트 (본공고 제외) ===\n');
  await service.run();
  console.log('\n=== 테스트 종료 ===');
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
