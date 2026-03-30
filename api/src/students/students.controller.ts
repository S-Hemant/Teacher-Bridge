import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SessionStatus, UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { StudentsService } from './students.service';

@ApiTags('students')
@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.student)
@ApiBearerAuth()
export class StudentsController {
  constructor(private readonly students: StudentsService) {}

  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return this.students.getMe(user.sub);
  }

  @Put('me')
  updateMe(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      displayName?: string;
      bio?: string;
      gradeLevel?: string;
      goals?: string;
    },
  ) {
    return this.students.updateMe(user.sub, body);
  }

  @Get('me/sessions')
  mySessions(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: SessionStatus,
  ) {
    return this.students.mySessions(user.sub, status);
  }

  @Post('me/sessions')
  book(
    @CurrentUser() user: JwtPayload,
    @Body() body: { teacherUserId: string; scheduledAt: string },
  ) {
    return this.students.bookSession(
      user.sub,
      body.teacherUserId,
      body.scheduledAt,
    );
  }

  @Get('me/saved-teachers')
  saved(@CurrentUser() user: JwtPayload) {
    return this.students.listSaved(user.sub);
  }

  @Post('me/saved-teachers')
  save(
    @CurrentUser() user: JwtPayload,
    @Body() body: { teacherUserId: string },
  ) {
    return this.students.saveTeacher(user.sub, body.teacherUserId);
  }

  @Delete('me/saved-teachers/:teacherUserId')
  unsave(
    @CurrentUser() user: JwtPayload,
    @Param('teacherUserId') teacherUserId: string,
  ) {
    return this.students.unsaveTeacher(user.sub, teacherUserId);
  }

  @Get('me/progress')
  progress(@CurrentUser() user: JwtPayload) {
    return this.students.progress(user.sub);
  }

  @Post('me/progress')
  addProgress(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      metricKey: string;
      value: Record<string, unknown>;
      subjectSlug?: string;
      teacherUserId?: string;
    },
  ) {
    return this.students.addProgress(user.sub, body);
  }

  @Post('me/documents')
  presignDoc(
    @CurrentUser() user: JwtPayload,
    @Body() body: { title: string; contentType: string; sizeBytes: number },
  ) {
    return this.students.presignDocument(
      user.sub,
      body.title,
      body.contentType,
      body.sizeBytes,
    );
  }

  @Get('me/documents')
  listDocs(@CurrentUser() user: JwtPayload) {
    return this.students.listDocuments(user.sub);
  }

  @Delete('me/documents/:docId')
  deleteDoc(@CurrentUser() user: JwtPayload, @Param('docId') docId: string) {
    return this.students.deleteDocument(user.sub, docId);
  }
}
