import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileJobService } from './profile-job.service';
import { ProfileService } from './profile.service';

@Module({
  controllers: [ProfileController],
  providers: [ProfileService, ProfileJobService],
  exports: [ProfileService, ProfileJobService],
})
export class ProfileModule {}
