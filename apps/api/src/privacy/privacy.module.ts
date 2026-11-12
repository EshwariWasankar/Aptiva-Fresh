import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrivacyController } from './privacy.controller';
import { PrivacyJobService, PrivacyService } from './privacy.service';

@Module({
  imports: [AuthModule],
  controllers: [PrivacyController],
  providers: [PrivacyService, PrivacyJobService],
})
export class PrivacyModule {}
