// src/calls/calls.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallsService } from './calls.service';
import { Call } from './call.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Call])],
  providers: [CallsService],
  exports: [CallsService],
})
export class CallsModule {}
