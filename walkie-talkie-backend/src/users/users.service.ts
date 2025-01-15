// src/users/users.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './user.entity';
import { Repository } from 'typeorm';
import { Room } from '../rooms/room.entity';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async addUser(socketId: string, room: Room): Promise<User> {
    this.logger.log(`Adding user with socket ID: ${socketId} to room ID: ${room.id}`);
    const user = this.usersRepository.create({ socketId, room });
    const savedUser = await this.usersRepository.save(user);
    this.logger.log(`User added: ${savedUser.socketId} to room: ${room.name}`);
    return savedUser;
  }

  async removeUserBySocketId(socketId: string): Promise<void> {
    this.logger.log(`Removing user with socket ID: ${socketId}`);
    await this.usersRepository.delete({ socketId });
    this.logger.log(`User with socket ID: ${socketId} removed.`);
  }

  async removeUserFromRoom(socketId: string, roomName: string): Promise<void> {
    this.logger.log(`Removing user with socket ID: ${socketId} from room: ${roomName}`);
    const user = await this.usersRepository.findOne({
      where: { socketId },
      relations: ['room'],
    });
    if (user && user.room.name === roomName) {
      await this.usersRepository.delete({ socketId });
      this.logger.log(`User ${socketId} removed from room ${roomName}`);
    } else {
      this.logger.warn(`User ${socketId} not found in room ${roomName}`);
    }
  }

  // Add other necessary methods with logs
}
