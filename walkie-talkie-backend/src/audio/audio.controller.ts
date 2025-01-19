import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  Res,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CallsService } from '../calls/calls.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';

@Controller('audio')
export class AudioController {
  constructor(private readonly callsService: CallsService) {}

  /**
   * Upload audio data for a specific call.
   * Expects 'callId' and 'audio' as form-data fields.
   */
  @Post('upload')
@UseInterceptors(FileInterceptor('audio'))
async uploadAudio(
  @Body('callId') callId: string,
  @UploadedFile() file: Express.Multer.File,
) {
  console.log('in uploadAudio ');
  console.log('callId: in uploadAudio ', callId);
  if (!callId) {
    throw new HttpException('callId is required', HttpStatus.BAD_REQUEST);
  }

  if (!file) {
    throw new HttpException('Audio file is required', HttpStatus.BAD_REQUEST);
  }

  console.log('Uploaded file:', file); // Log file details
  console.log('File buffer size:', file.buffer.length); // Log buffer size

  const call = await this.callsService.findCallById(callId);
  if (!call) {
    throw new HttpException('Call not found', HttpStatus.NOT_FOUND);
  }

  // Save the binary audio data
  await this.callsService.saveAudioData(callId, file.buffer);

  return { message: 'Audio data uploaded successfully' };
}


  /**
   * Download audio data for a specific call.
   * Returns the audio data as a binary stream.
   */
  @Get(':callId/download')
  async downloadAudio(
    @Param('callId') callId: string,
    @Res() res: Response,
  ) {
    const call = await this.callsService.findCallById(callId);
    if (!call || !call.audioData) {
      throw new HttpException('Audio data not found for this call', HttpStatus.NOT_FOUND);
    }

    // Set appropriate headers
    res.set({
      'Content-Type': 'audio/webm', // Adjust based on your recording format
      'Content-Disposition': `attachment; filename="call-${callId}.webm"`,
      'Content-Length': call.audioData.length,
    });

    // Send the binary audio data
    res.send(call.audioData);
  }

  @Get(':callId/play')
  async playAudio(
    @Param('callId') callId: string,
    @Res() res: Response,
  ) {
    console.log("callId" , callId);
    const call = await this.callsService.findCallById(callId);
    console.log("call" , call);
    if (!call || !call.audioData) {
      throw new HttpException('Audio data not found for this call', HttpStatus.NOT_FOUND);
    }

    // Set headers to enable audio playback
    res.set({
      'Content-Type': 'audio/webm', // Adjust based on your audio format
      'Content-Disposition': `inline; filename="call-${callId}.webm"`, // Inline for playback
      'Content-Length': call.audioData.length,
    });

    // Send the binary audio data for playback
    res.send(call.audioData);
  }
}
