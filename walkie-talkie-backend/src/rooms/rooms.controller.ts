// src/rooms/rooms.controller.ts
import { Controller, Get, Param, Logger } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { Room } from './room.entity';

@Controller('rooms')
export class RoomsController {
  private readonly logger = new Logger(RoomsController.name);

  constructor(private readonly roomsService: RoomsService) {}

  @Get(':name')
  async getRoom(@Param('name') name: string): Promise<Room | undefined> {
    this.logger.log(`Fetching room with name: ${name}`);
    const room = await this.roomsService.findByName(name);
    if (room) {
      this.logger.log(`Room found: ${name}`);
    } else {
      this.logger.warn(`Room not found: ${name}`);
    }
    return room;
  }

  // Add other endpoints with logs
}
