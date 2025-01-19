// src/calls/calls.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Call } from './call.entity';
import { Room } from '../rooms/room.entity';

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(
    @InjectRepository(Call)
    private callsRepository: Repository<Call>,
  ) {}

  async createCall(
    room: Room,
    callerSocketId: string,
    receiverSocketId: string,
  ): Promise<Call> {
    this.logger.log(
      `Creating call between ${callerSocketId} and ${receiverSocketId} in room: ${room.name}`,
    );
    const call = this.callsRepository.create({
      room,
      callerSocketId,
      receiverSocketId,
      startedAt: new Date(),
      endedAt: null, 
      audioData: null,
      duration: 0,
      transcript: null,
    });
    return this.callsRepository.save(call);
  }
  

  async endCall(callId: string): Promise<void> {
    this.logger.log(`Ending call with ID: ${callId}`);
    const call = await this.callsRepository.findOne({ where: { id: callId } });
    if (!call) {
      this.logger.error(`Call not found with ID: ${callId}`);
      throw new Error('Call not found');
    }

    call.endedAt = new Date();
    call.duration =
      (call.endedAt.getTime() - call.startedAt.getTime()) / 1000; // Duration in seconds
    await this.callsRepository.save(call);
  }

  async findCallById(callId: string): Promise<Call | undefined> {
    console.log(`Finding call with ID: ${callId}`);
    return this.callsRepository.findOne({ where: { id: callId } });
  }

  async saveAudioData(callId: string, audioBuffer: Buffer): Promise<void> {
    this.logger.log(`Saving audio data for call ID: ${callId}, Buffer size: ${audioBuffer.length}`);
    const result = await this.callsRepository.update(callId, { audioData: audioBuffer });
    this.logger.log(`Update result:`, result);
  }
  
}
