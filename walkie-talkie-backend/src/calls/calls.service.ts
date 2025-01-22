import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Call } from './call.entity';
import { Room } from '../rooms/room.entity';

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  // Initialize the Map directly as a private property
  private activeCallsByRoom: Map<string, string> = new Map();

  constructor(
    @InjectRepository(Call)
    private callsRepository: Repository<Call>
  ) {}

  async createCall(
    room: Room,
    callerSocketId: string,
    receiverSocketId: string,
  ): Promise<Call> {
    // Check if there's already an active call in this room
    const activeCallId = this.activeCallsByRoom.get(room.name);
    if (activeCallId) {
      throw new Error('There is already an active call in this room');
    }

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

    const savedCall = await this.callsRepository.save(call);
    this.activeCallsByRoom.set(room.name, savedCall.id);
    return savedCall;
  }

  async endCall(callId: string): Promise<void> {
    const call = await this.callsRepository.findOne({
      where: { id: callId },
      relations: ['room'],
    });

    if (!call) {
      throw new Error('Call not found');
    }

    call.endedAt = new Date();
    call.duration = (call.endedAt.getTime() - call.startedAt.getTime()) / 1000;
    await this.callsRepository.save(call);

    // Remove from active calls
    this.activeCallsByRoom.delete(call.room.name);
  }

  isCallActiveInRoom(roomName: string): boolean {
    return this.activeCallsByRoom.has(roomName);
  }

  async findCallById(callId: string): Promise<Call | undefined> {
    console.log(`Finding call with ID: ${callId}`);
    return this.callsRepository.findOne({ where: { id: callId } });
  }

  async saveAudioData(callId: string, audioBuffer: Buffer): Promise<void> {
    this.logger.log(`Saving audio data for call ID: ${callId}, Buffer size: ${audioBuffer.length}`);

    // Get existing call
    const call = await this.callsRepository.findOne({ where: { id: callId } });
    if (!call) {
      throw new Error('Call not found');
    }

    // If there's existing audio data, concatenate the new data
    if (call.audioData) {
      const combinedBuffer = Buffer.concat([call.audioData, audioBuffer]);
      call.audioData = combinedBuffer;
    } else {
      call.audioData = audioBuffer;
    }

    await this.callsRepository.save(call);
  }
}
