import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SessionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

export type TeacherListQuery = {
  q?: string;
  subject?: string;
  minRating?: number;
  maxPriceCents?: number;
  availableFrom?: string;
  availableTo?: string;
  minExperience?: number;
  sort?: 'rating' | 'price' | 'experience';
  page?: number;
  limit?: number;
};

@Injectable()
export class TeachersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async listPublic(q: TeacherListQuery) {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(50, Math.max(1, q.limit ?? 12));
    const skip = (page - 1) * limit;

    const and: Prisma.TeacherProfileWhereInput[] = [];

    if (q.subject) {
      and.push({
        OR: [
          { primarySubject: { slug: q.subject } },
          { subjects: { some: { subject: { slug: q.subject } } } },
        ],
      });
    }

    if (q.maxPriceCents != null) {
      and.push({ hourlyRateCents: { lte: q.maxPriceCents } });
    }

    if (q.minExperience != null) {
      and.push({ yearsExperience: { gte: q.minExperience } });
    }

    if (q.q?.trim()) {
      const term = q.q.trim();
      and.push({
        OR: [
          { user: { profile: { displayName: { contains: term, mode: 'insensitive' } } } },
          { headline: { contains: term, mode: 'insensitive' } },
        ],
      });
    }

    if (q.availableFrom && q.availableTo) {
      const from = new Date(q.availableFrom);
      const to = new Date(q.availableTo);
      and.push({
        availability: {
          some: {
            startAt: { lte: to },
            endAt: { gte: from },
          },
        },
      });
    }

    const where: Prisma.TeacherProfileWhereInput =
      and.length > 0 ? { AND: and } : {};

    const teachers = await this.prisma.teacherProfile.findMany({
      where,
      include: {
        user: { include: { profile: true } },
        primarySubject: true,
        subjects: { include: { subject: true } },
        reviews: true,
      },
      skip,
      take: limit,
    });

    const withAgg = teachers.map((tp) => {
      const avg =
        tp.reviews.length > 0
          ? tp.reviews.reduce((a, r) => a + r.rating, 0) / tp.reviews.length
          : 0;
      return {
        id: tp.userId,
        profile: tp.user.profile,
        headline: tp.headline,
        hourlyRateCents: tp.hourlyRateCents,
        currency: tp.currency,
        yearsExperience: tp.yearsExperience,
        primarySubject: tp.primarySubject,
        subjects: tp.subjects.map((s) => s.subject),
        ratingAvg: Math.round(avg * 10) / 10,
        reviewCount: tp.reviews.length,
      };
    });

    let sorted = withAgg;
    if (q.minRating != null) {
      sorted = sorted.filter((t) => t.ratingAvg >= (q.minRating ?? 0));
    }
    if (q.sort === 'price') {
      sorted.sort((a, b) => a.hourlyRateCents - b.hourlyRateCents);
    } else if (q.sort === 'experience') {
      sorted.sort((a, b) => b.yearsExperience - a.yearsExperience);
    } else {
      sorted.sort((a, b) => b.ratingAvg - a.ratingAvg);
    }

    const total = await this.prisma.teacherProfile.count({ where });

    return { data: sorted, page, limit, total };
  }

  async getPublic(teacherUserId: string) {
    const tp = await this.prisma.teacherProfile.findFirst({
      where: { userId: teacherUserId },
      include: {
        user: { include: { profile: true } },
        primarySubject: true,
        subjects: { include: { subject: true } },
        tags: { include: { tag: true } },
        reviews: { include: { student: { include: { profile: true } } } },
      },
    });
    if (!tp) throw new NotFoundException();
    const avg =
      tp.reviews.length > 0
        ? tp.reviews.reduce((a, r) => a + r.rating, 0) / tp.reviews.length
        : 0;
    return {
      id: tp.userId,
      profile: tp.user.profile,
      headline: tp.headline,
      hourlyRateCents: tp.hourlyRateCents,
      currency: tp.currency,
      yearsExperience: tp.yearsExperience,
      teachingPreferences: tp.teachingPreferences,
      primarySubject: tp.primarySubject,
      subjects: tp.subjects.map((s) => s.subject),
      tags: tp.tags.map((t) => t.tag),
      ratingAvg: Math.round(avg * 10) / 10,
      reviewCount: tp.reviews.length,
      reviews: tp.reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        studentName: r.student.profile?.displayName ?? 'Student',
      })),
    };
  }

  async getMe(userId: string) {
    const tp = await this.prisma.teacherProfile.findUnique({
      where: { userId },
      include: {
        user: { include: { profile: true } },
        primarySubject: true,
        subjects: { include: { subject: true } },
        tags: { include: { tag: true } },
        availability: true,
      },
    });
    if (!tp) throw new NotFoundException();
    return tp;
  }

  async updateMe(
    userId: string,
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
    const tp = await this.prisma.teacherProfile.findUnique({
      where: { userId },
    });
    if (!tp) throw new NotFoundException();

    let primarySubjectId = tp.primarySubjectId;
    if (body.primarySubjectSlug) {
      const sub = await this.prisma.subject.findUnique({
        where: { slug: body.primarySubjectSlug },
      });
      if (sub) primarySubjectId = sub.id;
    }

    await this.prisma.teacherProfile.update({
      where: { id: tp.id },
      data: {
        headline: body.headline ?? undefined,
        hourlyRateCents: body.hourlyRateCents ?? undefined,
        currency: body.currency ?? undefined,
        yearsExperience: body.yearsExperience ?? undefined,
        primarySubjectId: primarySubjectId ?? undefined,
        teachingPreferences: (body.teachingPreferences as object) ?? undefined,
      },
    });

    if (body.subjectSlugs?.length) {
      const subjects = await this.prisma.subject.findMany({
        where: { slug: { in: body.subjectSlugs } },
      });
      await this.prisma.teacherSubject.deleteMany({
        where: { teacherId: tp.id },
      });
      await this.prisma.teacherSubject.createMany({
        data: subjects.map((s) => ({ teacherId: tp.id, subjectId: s.id })),
      });
    }

    if (body.tagNames?.length) {
      const tags = await Promise.all(
        body.tagNames.map((name) =>
          this.prisma.tag.upsert({
            where: { name },
            update: {},
            create: { name },
          }),
        ),
      );
      await this.prisma.teacherTag.deleteMany({ where: { teacherId: tp.id } });
      await this.prisma.teacherTag.createMany({
        data: tags.map((t) => ({ teacherId: tp.id, tagId: t.id })),
      });
    }

    return this.getMe(userId);
  }

  async setAvailability(
    userId: string,
    slots: { startAt: string; endAt: string }[],
  ) {
    const tp = await this.prisma.teacherProfile.findUnique({
      where: { userId },
    });
    if (!tp) throw new NotFoundException();
    await this.prisma.availabilitySlot.deleteMany({
      where: { teacherId: tp.id },
    });
    await this.prisma.availabilitySlot.createMany({
      data: slots.map((s) => ({
        teacherId: tp.id,
        startAt: new Date(s.startAt),
        endAt: new Date(s.endAt),
      })),
    });
    return this.getMe(userId);
  }

  async mySessions(userId: string, status?: SessionStatus) {
    const where: Prisma.LearningSessionWhereInput = { teacherId: userId };
    if (status) where.status = status;
    return this.prisma.learningSession.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
      include: {
        student: { include: { profile: true } },
      },
    });
  }

  async studentProgress(teacherUserId: string, studentId: string) {
    const tp = await this.prisma.teacherProfile.findUnique({
      where: { userId: teacherUserId },
    });
    if (!tp) throw new NotFoundException();
    const sessions = await this.prisma.learningSession.findMany({
      where: { teacherId: teacherUserId, studentId },
      orderBy: { scheduledAt: 'desc' },
    });
    const progress = await this.prisma.progressEntry.findMany({
      where: { studentId },
      orderBy: { recordedAt: 'desc' },
      take: 50,
    });
    return { sessions, progress };
  }

  async presignDocument(userId: string, title: string, contentType: string, sizeBytes: number) {
    const tp = await this.prisma.teacherProfile.findUnique({
      where: { userId },
    });
    if (!tp) throw new NotFoundException();
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
