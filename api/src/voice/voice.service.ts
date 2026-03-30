import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { VoiceQueryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class VoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
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
}
