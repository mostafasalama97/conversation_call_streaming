// src/signaling/signaling.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RoomsService } from '../rooms/rooms.service';
import { UsersService } from '../users/users.service';
import { Logger } from '@nestjs/common';
import { CallsService } from '../calls/calls.service';

@WebSocketGateway(4000, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})
export class SignalingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SignalingGateway.name);

  constructor(
    private readonly roomsService: RoomsService,
    private readonly usersService: UsersService,
    private readonly callsService: CallsService,
  ) {}

  async handleConnection(socket: Socket) {
    this.logger.log(`Client connected: ${socket.id}`);
  }

  async handleDisconnect(socket: Socket) {
    this.logger.log(`Client disconnected: ${socket.id}`);
    // await this.usersService.removeUserBySocketId(socket.id);
    // this.logger.log(`User with socket ID ${socket.id} removed from all rooms.`);
  }

  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @MessageBody() data: { room: string },
    @ConnectedSocket() socket: Socket,
  ) {
    this.logger.log(`Received 'join-room' from ${socket.id} for room: ${data.room}`);
    const { room } = data;
    let roomEntity = await this.roomsService.findByName(room);
    if (!roomEntity) {
      roomEntity = await this.roomsService.createRoom(room);
      this.logger.log(`Room created: ${room}`);
    }
    await this.usersService.addUser(socket.id, roomEntity);
    console.log("user added in corectlly in db in signaling file>>>>>>", roomEntity);
    socket.join(room);

    this.server.to(room).emit('user-joined', { socketId: socket.id });
    this.logger.log(`Notified room ${room} that user ${socket.id} has joined.`);
  }

  @SubscribeMessage('signal')
  handleSignal(
    @MessageBody() data: { to: string; signal: any },
    @ConnectedSocket() socket: Socket,
  ) {
    this.logger.log(`Received 'signal' from ${socket.id} to ${data.to}`);
    const { to, signal } = data;
    this.server.to(to).emit('signal', { from: socket.id, signal });
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @MessageBody() data: { room: string },
    @ConnectedSocket() socket: Socket,
  ) {
    this.logger.log(`Received 'leave-room' from ${socket.id} for room: ${data.room}`);
    const { room } = data;
    // await this.usersService.removeUserFromRoom(socket.id, room);
    socket.leave(room);
    this.server.to(room).emit('user-left', { socketId: socket.id });
  }

  @SubscribeMessage('start-call')
  async handleStartCall(
    @MessageBody() data: { room: string; receiverSocketId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { room, receiverSocketId } = data;
    const roomEntity = await this.roomsService.findByName(room);
  
    if (!roomEntity) {
      this.logger.error(`Room not found: ${room}`);
      client.emit('error', { message: `Room ${room} not found.` });
      return;
    }
  
    if (!receiverSocketId) {
      this.logger.error('Receiver socket ID is undefined.');
      client.emit('error', { message: 'Receiver socket ID is required.' });
      return;
    }
  
    try {
      const call = await this.callsService.createCall(roomEntity, client.id, receiverSocketId);
      this.logger.log(`Call started with ID: ${call.id}`);
  
      // Emit `call-started` to the initiator
      client.emit('call-started', { callId: call.id });
  
      // Notify the receiver that a call has started
      this.server.to(receiverSocketId).emit('incoming-call', { callId: call.id, from: client.id });
    } catch (error) {
      this.logger.error(`Failed to start call: ${error.message}`);
      client.emit('error', { message: 'Failed to start call. Please try again.' });
    }
  }
  
  

  @SubscribeMessage('end-call')
  async handleEndCall(
    @MessageBody() data: { callId: string; room: string },
    @ConnectedSocket() client: Socket,
  ) {
    await this.callsService.endCall(data.callId);
    this.server.to(data.room).emit('speaking-status', { socketId: client.id, isSpeaking: false });
    this.logger.log(`Call ended with ID: ${data.callId}`);

    // Notify both parties that the call has ended
    const call = await this.callsService.findCallById(data.callId);
    if (call) {
      this.server.to(call.callerSocketId).emit('call-ended', { callId: data.callId });
      this.server.to(call.receiverSocketId).emit('call-ended', { callId: data.callId });
    }
  }


  @SubscribeMessage('start-speaking')
  handleStartSpeaking(
    @MessageBody() data: { room: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const { room } = data;
    this.logger.log(`User ${socket.id} started speaking in room: ${room}`);
    this.server.to(room).emit('speaking-status', { socketId: socket.id, isSpeaking: true });
  }
  
  @SubscribeMessage('stop-speaking')
  handleStopSpeaking(
    @MessageBody() data: { room: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const { room } = data;
    this.logger.log(`User ${socket.id} stopped speaking in room: ${room}`);
    this.server.to(room).emit('speaking-status', { socketId: socket.id, isSpeaking: false });
  }
}
