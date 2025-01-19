// src/audio/audio.module.ts
import { Module } from '@nestjs/common';
import { AudioController } from './audio.controller';
import { CallsModule } from '../calls/calls.module';

@Module({
  imports: [CallsModule],
  controllers: [AudioController],
})
export class AudioModule {}
