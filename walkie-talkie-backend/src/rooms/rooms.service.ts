// src/rooms/rooms.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Room } from './room.entity';
import { Repository } from 'typeorm';

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(
    @InjectRepository(Room)
    private roomsRepository: Repository<Room>,
  ) {}

  async findByName(name: string): Promise<Room | undefined> {
    this.logger.log(`Finding room by name: ${name}`);
    const room = await this.roomsRepository.findOne({ where: { name }, relations: ['users'] });
    if (room) {
      this.logger.log(`Room found: ${name} with ID: ${room.id}`);
    } else {
      this.logger.warn(`Room not found: ${name}`);
    }
    return room;
  }

  async createRoom(name: string): Promise<Room> {
    this.logger.log(`Creating new room: ${name}`);
    const room = this.roomsRepository.create({ name });
    const savedRoom = await this.roomsRepository.save(room);
    this.logger.log(`Room created: ${savedRoom.name} with ID: ${savedRoom.id}`);
    return savedRoom;
  }

  // Add other necessary methods with logs
}
