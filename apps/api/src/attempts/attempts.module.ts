import { Module } from '@nestjs/common';
import { AttemptStreamService } from './attempt-stream.service';
import { AttemptsService } from './attempts.service';
import { RecalcService } from './recalc.service';
import { NotebookController } from './notebook.controller';
import { SessionsController } from './sessions.controller';

@Module({
  controllers: [SessionsController, NotebookController],
  providers: [AttemptsService, AttemptStreamService, RecalcService],
  exports: [AttemptsService, AttemptStreamService, RecalcService],
})
export class AttemptsModule {}
