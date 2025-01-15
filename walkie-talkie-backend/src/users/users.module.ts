import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])], // Add this line
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService], // Export if other modules need UsersService
})
export class UsersModule {}
