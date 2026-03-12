import { Module } from '@nestjs/common';
import { DAILY_TASKS } from '../daily/daily.constants';
import { KeywordExpanderService } from './keyword-expander.service';
import { ProcurementPreSpecService } from './procurement-pre-spec.service';
import { ReportMailerService } from './report-mailer.service';

@Module({
  providers: [
    KeywordExpanderService,
    ReportMailerService,
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
  exports: [DAILY_TASKS, ProcurementPreSpecService, ReportMailerService],
})
export class ProcurementModule {}
