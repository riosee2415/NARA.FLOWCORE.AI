import { Module } from '@nestjs/common';
import { LawTimesService } from './lawtimes.service';
import { LawTimesController } from './lawtimes.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [LawTimesService],
  controllers: [LawTimesController],
  exports: [LawTimesService],
})
export class LawTimesModule {}
