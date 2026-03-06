import { Module } from '@nestjs/common';
import { DAILY_TASKS } from '../daily/daily.constants';
import { KeywordExpanderService } from './keyword-expander.service';
import { ProcurementPreSpecService } from './procurement-pre-spec.service';

@Module({
  providers: [
    KeywordExpanderService,
    ProcurementPreSpecService,
    {
      provide: DAILY_TASKS,
      useExisting: ProcurementPreSpecService,
      multi: true,
    } as {
      provide: symbol;
      useExisting: typeof ProcurementPreSpecService;
      multi: true;
    },
  ],
  exports: [DAILY_TASKS, ProcurementPreSpecService],
})
export class ProcurementModule {}
