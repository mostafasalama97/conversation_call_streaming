import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsService } from './rooms.service';
import { RoomsController } from './rooms.controller';
import { Room } from './room.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Room])], // Add this line
  providers: [RoomsService],
  controllers: [RoomsController],
  exports: [RoomsService], // Export if other modules need RoomsService
})
export class RoomsModule {}
