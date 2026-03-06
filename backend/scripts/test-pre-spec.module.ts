/**
 * 사전규격 조회 테스트 전용 모듈 (Config + Procurement만 로드)
 */
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProcurementModule } from '../src/procurement/procurement.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ProcurementModule],
})
export class TestPreSpecModule {}
