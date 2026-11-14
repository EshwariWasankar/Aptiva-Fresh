import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module';
import { ExternalScoresController } from './external-scores.controller';
import { ExternalScoresService } from './external-scores.service';

@Module({
  imports: [PrismaModule],
  controllers: [ExternalScoresController],
  providers: [ExternalScoresService],
  exports: [ExternalScoresService],
})
export class ExternalScoresModule {}
