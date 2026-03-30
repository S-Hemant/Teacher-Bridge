import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { SessionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async getMe(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        studentProfile: true,
      },
    });
    if (!u) throw new NotFoundException();
    const { passwordHash: _, ...rest } = u;
    return rest;
  }

  async updateMe(
    userId: string,
    body: {
      displayName?: string;
      bio?: string;
      gradeLevel?: string;
      goals?: string;
    },
  ) {
    await this.prisma.profile.updateMany({
      where: { userId },
      data: {
        displayName: body.displayName,
        bio: body.bio,
      },
    });
    await this.prisma.studentProfile.updateMany({
      where: { userId },
      data: {
        gradeLevel: body.gradeLevel,
        goals: body.goals,
      },
    });
    return this.getMe(userId);
  }

  async mySessions(userId: string, status?: SessionStatus) {
    const where: { studentId: string; status?: SessionStatus } = {
      studentId: userId,
    };
    if (status) where.status = status;
    return this.prisma.learningSession.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
      include: {
        teacher: { include: { profile: true } },
      },
    });
  }

  async bookSession(studentId: string, teacherUserId: string, scheduledAt: string) {
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherUserId },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');
    return this.prisma.learningSession.create({
      data: {
        studentId,
        teacherId: teacherUserId,
        scheduledAt: new Date(scheduledAt),
        status: SessionStatus.scheduled,
      },
      include: {
        teacher: { include: { profile: true } },
      },
    });
  }

  async listSaved(studentId: string) {
    const rows = await this.prisma.savedTeacher.findMany({
      where: { studentId },
      include: {
        teacher: {
          include: {
            profile: true,
            teacherProfile: {
              include: {
                primarySubject: true,
                reviews: true,
              },
            },
          },
        },
      },
    });
    return rows.map((r) => {
      const tp = r.teacher.teacherProfile;
      const avg =
        tp && tp.reviews.length > 0
          ? tp.reviews.reduce((a, x) => a + x.rating, 0) / tp.reviews.length
          : 0;
      return {
        savedAt: r.createdAt,
        teacher: {
          id: r.teacher.id,
          profile: r.teacher.profile,
          headline: tp?.headline,
          hourlyRateCents: tp?.hourlyRateCents,
          primarySubject: tp?.primarySubject,
          ratingAvg: Math.round(avg * 10) / 10,
        },
      };
    });
  }

  async saveTeacher(studentId: string, teacherUserId: string) {
    try {
      const t = await this.prisma.teacherProfile.findUnique({
        where: { userId: teacherUserId },
      });
      if (!t) throw new NotFoundException('Teacher not found');
      await this.prisma.savedTeacher.create({
        data: { studentId, teacherId: teacherUserId },
      });
      return { ok: true };
    } catch (e) {
      if (
        e &&
        typeof e === 'object' &&
        'code' in e &&
        (e as { code?: string }).code === 'P2002'
      ) {
        throw new ConflictException('Already saved');
      }
      throw e;
    }
  }

  async unsaveTeacher(studentId: string, teacherUserId: string) {
    await this.prisma.savedTeacher.deleteMany({
      where: { studentId, teacherId: teacherUserId },
    });
    return { ok: true };
  }

  async progress(studentId: string) {
    const entries = await this.prisma.progressEntry.findMany({
      where: { studentId },
      orderBy: { recordedAt: 'asc' },
      include: { subject: true },
    });
    const sessions = await this.prisma.learningSession.count({
      where: { studentId, status: SessionStatus.completed },
    });
    return { entries, completedSessions: sessions };
  }

  async addProgress(
    studentId: string,
    body: {
      metricKey: string;
      value: Record<string, unknown>;
      subjectSlug?: string;
      teacherUserId?: string;
    },
  ) {
    let subjectId: string | undefined;
    if (body.subjectSlug) {
      const s = await this.prisma.subject.findUnique({
        where: { slug: body.subjectSlug },
      });
      subjectId = s?.id;
    }
    return this.prisma.progressEntry.create({
      data: {
        studentId,
        teacherId: body.teacherUserId,
        subjectId,
        metricKey: body.metricKey,
        value: body.value as object,
      },
    });
  }

  async presignDocument(
    userId: string,
    title: string,
    contentType: string,
    sizeBytes: number,
  ) {
    const { storageKey, uploadUrl, expiresIn } =
      await this.storage.getPresignedPutUrl({
        keyPrefix: `documents/${userId}`,
        contentType,
        maxBytes: sizeBytes,
      });
    const doc = await this.prisma.document.create({
      data: {
        ownerUserId: userId,
        title,
        storageKey,
        mimeType: contentType,
        sizeBytes,
      },
    });
    return { documentId: doc.id, uploadUrl, expiresIn, storageKey };
  }

  async deleteDocument(userId: string, docId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id: docId, ownerUserId: userId },
    });
    if (!doc) throw new NotFoundException();
    await this.prisma.document.delete({ where: { id: docId } });
    return { ok: true };
  }

  async listDocuments(userId: string) {
    return this.prisma.document.findMany({
      where: { ownerUserId: userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
