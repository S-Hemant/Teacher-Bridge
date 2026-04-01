import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { VoiceService } from './voice.service';

@ApiTags('voice-queries')
@Controller('voice-queries')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.student)
@ApiBearerAuth()
export class VoiceController {
  constructor(private readonly voice: VoiceService) {}

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() body: { contentType?: string },
  ) {
    return this.voice.createPresigned(user.sub, body?.contentType ?? 'audio/webm');
  }

  @Post(':id/complete')
  complete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.voice.complete(user.sub, id);
  }

  @Get(':id')
  getOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.voice.getOne(user.sub, id);
  }

  @Patch(':id')
  updateTranscript(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('transcript') transcript: string,
  ) {
    return this.voice.updateTranscript(user.sub, id, transcript);
  }
}
