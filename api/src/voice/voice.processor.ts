import { ConfigService } from '@nestjs/config';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { VoiceQueryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { MatchingService } from '../matching/matching.service';
import { VoiceNotificationsGateway } from './voice-notifications.gateway';

@Processor('voice')
export class VoiceProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly matching: MatchingService,
    private readonly config: ConfigService,
    private readonly voiceGateway: VoiceNotificationsGateway,
  ) {
    super();
  }

  async process(job: Job<{ voiceQueryId: string }>): Promise<void> {
    const { voiceQueryId } = job.data;
    const meta = await this.prisma.voiceQuery.findUnique({
      where: { id: voiceQueryId },
      select: { studentId: true },
    });
    const studentId = meta?.studentId;

    await this.prisma.voiceQuery.update({
      where: { id: voiceQueryId },
      data: { status: VoiceQueryStatus.processing },
    });

    try {
      const vq = await this.prisma.voiceQuery.findUniqueOrThrow({
        where: { id: voiceQueryId },
      });

      const bucket = this.storage.getBucket();
      const getCmd = new GetObjectCommand({
        Bucket: bucket,
        Key: vq.audioStorageKey,
      });
      const obj = await this.storage.getClient().send(getCmd);
      const bytes = await this.streamToBuffer(obj.Body);

      const transcript = await this.transcribe(bytes, vq.audioStorageKey);
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
            status: VoiceQueryStatus.done,
            transcript,
            nlpResult: nlpJson as object,
          },
        });
      });
      if (studentId) {
        this.voiceGateway.notifyVoiceQueryComplete(
          studentId,
          voiceQueryId,
          'done',
        );
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Voice job failed';
      await this.prisma.voiceQuery.update({
        where: { id: voiceQueryId },
        data: {
          status: VoiceQueryStatus.failed,
          errorMessage: message,
        },
      });
      if (studentId) {
        this.voiceGateway.notifyVoiceQueryComplete(
          studentId,
          voiceQueryId,
          'failed',
        );
      }
    }
  }

  private async streamToBuffer(body: unknown): Promise<Buffer> {
    if (!body) return Buffer.alloc(0);
    const chunks: Uint8Array[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  private async transcribe(audio: Buffer, storageKey: string): Promise<string> {
    const key = this.config.get<string>('OPENAI_API_KEY');
    if (!key) {
      return 'I need help with mathematics calculus homework and derivatives exam preparation.';
    }

    const form = new FormData();
    const blob = new Blob([new Uint8Array(audio)]);
    form.append(
      'file',
      blob,
      storageKey.endsWith('.webm') ? 'audio.webm' : 'audio.bin',
    );
    form.append('model', 'whisper-1');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Whisper failed: ${res.status} ${t}`);
    }
    const data = (await res.json()) as { text?: string };
    return data.text ?? '';
  }
}
