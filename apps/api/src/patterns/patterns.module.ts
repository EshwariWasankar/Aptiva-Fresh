import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { PatternsController } from './patterns.controller';
import { PatternsService } from './patterns.service';

@Module({
  imports: [PrismaModule],
  controllers: [PatternsController],
  providers: [PatternsService],
  exports: [PatternsService],
})
export class PatternsModule {}
