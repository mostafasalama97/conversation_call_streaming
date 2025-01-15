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

  async createCall(room: Room, callerSocketId: string, receiverSocketId: string): Promise<Call> {
    this.logger.log(`Creating call between ${callerSocketId} and ${receiverSocketId} in room: ${room.name}`);
    const call = this.callsRepository.create({
      room,
      callerSocketId,
      receiverSocketId,
      startedAt: new Date(),
      endedAt: null,
    });
    return this.callsRepository.save(call);
  }

  async endCall(callId: string): Promise<void> {
    this.logger.log(`Ending call with ID: ${callId}`);
    await this.callsRepository.update(callId, { endedAt: new Date() });
  }
}
