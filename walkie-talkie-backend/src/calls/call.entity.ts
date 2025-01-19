// src/calls/call.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
  } from 'typeorm';
  import { Room } from '../rooms/room.entity';
  
  @Entity()
  export class Call {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @ManyToOne(() => Room, { onDelete: 'CASCADE' })
    room: Room;
  
    @Column()
    callerSocketId: string;
  
    @Column()
    receiverSocketId: string;
  
    @CreateDateColumn()
    startedAt: Date;
  
    @Column({ nullable: true })
    endedAt: Date | null;
    
  
    @Column({ type: 'bytea', nullable: true }) // Binary data type for PostgreSQL
    audioData: Buffer | null;
    
    // Additional fields for analytics
    @Column({ type: 'float', default: 0 })
    duration: number; // Duration in seconds (float)
    
  
    @Column({ nullable: true })
    transcript: string; // If you plan to implement transcription
  }
  