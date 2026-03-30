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
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/types/jwt-payload.type';
import { TeachersService } from './teachers.service';

@ApiTags('teachers')
@Controller('teachers')
export class TeachersController {
  constructor(private readonly teachers: TeachersService) {}

  @Public()
  @Get()
  list(
    @Query('q') q?: string,
    @Query('subject') subject?: string,
    @Query('minRating') minRating?: string,
    @Query('maxPriceCents') maxPriceCents?: string,
    @Query('availableFrom') availableFrom?: string,
    @Query('availableTo') availableTo?: string,
    @Query('minExperience') minExperience?: string,
    @Query('sort') sort?: 'rating' | 'price' | 'experience',
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.teachers.listPublic({
      q,
      subject,
      minRating: minRating ? Number(minRating) : undefined,
      maxPriceCents: maxPriceCents ? Number(maxPriceCents) : undefined,
      availableFrom,
      availableTo,
      minExperience: minExperience ? Number(minExperience) : undefined,
      sort,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher)
  @ApiBearerAuth()
  me(@CurrentUser() user: JwtPayload) {
    return this.teachers.getMe(user.sub);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher)
  @ApiBearerAuth()
  updateMe(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      headline?: string;
      hourlyRateCents?: number;
      currency?: string;
      yearsExperience?: number;
      primarySubjectSlug?: string;
      subjectSlugs?: string[];
      tagNames?: string[];
      teachingPreferences?: Record<string, unknown>;
    },
  ) {
    return this.teachers.updateMe(user.sub, body);
  }

  @Put('me/availability')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher)
  @ApiBearerAuth()
  availability(
    @CurrentUser() user: JwtPayload,
    @Body() body: { slots: { startAt: string; endAt: string }[] },
  ) {
    return this.teachers.setAvailability(user.sub, body.slots ?? []);
  }

  @Get('me/sessions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher)
  @ApiBearerAuth()
  mySessions(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: SessionStatus,
  ) {
    return this.teachers.mySessions(user.sub, status);
  }

  @Get('me/students/:studentId/progress')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher)
  @ApiBearerAuth()
  studentProgress(
    @CurrentUser() user: JwtPayload,
    @Param('studentId') studentId: string,
  ) {
    return this.teachers.studentProgress(user.sub, studentId);
  }

  @Post('me/documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher)
  @ApiBearerAuth()
  presignDoc(
    @CurrentUser() user: JwtPayload,
    @Body() body: { title: string; contentType: string; sizeBytes: number },
  ) {
    return this.teachers.presignDocument(
      user.sub,
      body.title,
      body.contentType,
      body.sizeBytes,
    );
  }

  @Get('me/documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher)
  @ApiBearerAuth()
  listDocs(@CurrentUser() user: JwtPayload) {
    return this.teachers.listDocuments(user.sub);
  }

  @Delete('me/documents/:docId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher)
  @ApiBearerAuth()
  deleteDoc(@CurrentUser() user: JwtPayload, @Param('docId') docId: string) {
    return this.teachers.deleteDocument(user.sub, docId);
  }

  @Public()
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.teachers.getPublic(id);
  }
}
