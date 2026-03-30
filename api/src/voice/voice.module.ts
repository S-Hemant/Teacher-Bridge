import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MatchingModule } from '../matching/matching.module';
import { VoiceController } from './voice.controller';
import { VoiceNotificationsGateway } from './voice-notifications.gateway';
import { VoiceProcessor } from './voice.processor';
import { VoiceService } from './voice.service';

@Module({
  imports: [
    AuthModule,
    MatchingModule,
    BullModule.registerQueue({ name: 'voice' }),
  ],
  controllers: [VoiceController],
  providers: [VoiceService, VoiceProcessor, VoiceNotificationsGateway],
  exports: [VoiceService],
})
export class VoiceModule {}
