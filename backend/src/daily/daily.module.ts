import { Module } from '@nestjs/common';
import { DailyService } from './daily.service';
import { ProcurementModule } from '../procurement/procurement.module';

@Module({
  imports: [ProcurementModule],
  providers: [DailyService],
  exports: [DailyService],
})
export class DailyModule {}
