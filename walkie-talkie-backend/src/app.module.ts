// src/app.module.ts
import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoomsModule } from './rooms/rooms.module';
import { UsersModule } from './users/users.module';
import { CallsModule } from './calls/calls.module';
import { SignalingGateway } from './signaling/signaling.gateway';
import { Room } from './rooms/room.entity';
import { User } from './users/user.entity';
import { Call } from './calls/call.entity';
import { AudioController } from './audio/audio.controller';
import { AudioModule } from './audio/audio.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost', // Update as needed
      port: 5432,
      username: 'postgres',
      password: '123',
      database: 'ai_voice_chat',
      entities: [Room, User, Call],
      synchronize: true, // Disable in production
    }),
    RoomsModule,
    UsersModule,
    CallsModule,
    AudioModule, // Add AudioModule here
  ],
  providers: [SignalingGateway],
})
export class AppModule {
  private readonly logger = new Logger(AppModule.name);

  constructor() {
    this.logger.log('AppModule initialized.');
  }
}
