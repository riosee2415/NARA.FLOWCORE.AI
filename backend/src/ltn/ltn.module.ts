import { Module } from '@nestjs/common';
import { LtnService } from './ltn.service';
import { LtnController } from './ltn.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [LtnService],
  controllers: [LtnController],
  exports: [LtnService],
})
export class LtnModule {}
