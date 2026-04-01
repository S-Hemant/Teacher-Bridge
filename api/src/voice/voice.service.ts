import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { VoiceQueryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { MatchingService } from '../matching/matching.service';

@Injectable()
export class VoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly matching: MatchingService,
    @InjectQueue('voice') private readonly voiceQueue: Queue,
  ) {}

  async createPresigned(studentId: string, contentType: string) {
    const { storageKey, uploadUrl, expiresIn } =
      await this.storage.getPresignedPutUrl({
        keyPrefix: `voice/${studentId}`,
        contentType: contentType || 'audio/webm',
        maxBytes: 25 * 1024 * 1024,
      });

    const vq = await this.prisma.voiceQuery.create({
      data: {
        studentId,
        audioStorageKey: storageKey,
        status: VoiceQueryStatus.pending,
      },
    });

    return { voiceQueryId: vq.id, uploadUrl, expiresIn, storageKey };
  }

  async complete(studentId: string, voiceQueryId: string) {
    const vq = await this.prisma.voiceQuery.findUnique({
      where: { id: voiceQueryId },
    });
    if (!vq || vq.studentId !== studentId) {
      throw new NotFoundException();
    }
    await this.voiceQueue.add('process', { voiceQueryId }, { removeOnComplete: true });
    return { ok: true, status: VoiceQueryStatus.pending };
  }

  async getOne(studentId: string, voiceQueryId: string) {
    const vq = await this.prisma.voiceQuery.findUnique({
      where: { id: voiceQueryId },
      include: {
        recommendations: {
          orderBy: { rank: 'asc' },
          include: {
            teacher: {
              include: {
                user: { include: { profile: true } },
                primarySubject: true,
              },
            },
          },
        },
      },
    });
    if (!vq || vq.studentId !== studentId) {
      throw new NotFoundException();
    }
    return vq;
  }

  async updateTranscript(studentId: string, voiceQueryId: string, transcript: string) {
    const vq = await this.prisma.voiceQuery.findUnique({
      where: { id: voiceQueryId },
    });
    if (!vq || vq.studentId !== studentId) {
      throw new NotFoundException();
    }

    const nlp = this.matching.parseTranscriptHeuristic(transcript);
    const nlpJson = {
      ...nlp,
      transcriptPreview: transcript.slice(0, 500),
    };
    const ranked = await this.matching.scoreTeachers(nlp, 10);

    await this.prisma.$transaction(async (tx) => {
      await tx.voiceQueryRecommendation.deleteMany({
        where: { voiceQueryId },
      });
      for (const r of ranked) {
        await tx.voiceQueryRecommendation.create({
          data: {
            voiceQueryId,
            teacherId: r.teacherProfileId,
            score: r.score,
            rank: r.rank,
            reason: r.reason as object,
          },
        });
      }
      await tx.voiceQuery.update({
        where: { id: voiceQueryId },
        data: {
          transcript,
          nlpResult: nlpJson as object,
        },
      });
    });

    return this.getOne(studentId, voiceQueryId);
  }
}
