import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService implements OnModuleInit {
  private client: S3Client;
  private bucket: string;
  private forcePathStyle: boolean;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('S3_ENDPOINT');
    this.forcePathStyle = this.config.get<string>('S3_FORCE_PATH_STYLE') === 'true';
    this.client = new S3Client({
      region: this.config.get<string>('S3_REGION') ?? 'us-east-1',
      endpoint: endpoint || undefined,
      forcePathStyle: this.forcePathStyle,
      credentials: {
        accessKeyId: this.config.getOrThrow<string>('S3_ACCESS_KEY'),
        secretAccessKey: this.config.getOrThrow<string>('S3_SECRET_KEY'),
      },
    });
    this.bucket = this.config.getOrThrow<string>('S3_BUCKET');
  }

  async onModuleInit() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(
          new CreateBucketCommand({ Bucket: this.bucket }),
        );
      } catch {
        /* Bucket may be created externally; uploads will fail until fixed. */
      }
    }
  }

  /** Presigned PUT for browser direct upload (private object). */
  async getPresignedPutUrl(params: {
    keyPrefix: string;
    contentType: string;
    maxBytes: number;
  }): Promise<{ storageKey: string; uploadUrl: string; expiresIn: number }> {
    const storageKey = `${params.keyPrefix}/${randomUUID()}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: params.contentType,
    });
    const expiresIn = 3600;
    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn });
    return { storageKey, uploadUrl, expiresIn };
  }

  getBucket(): string {
    return this.bucket;
  }

  getClient(): S3Client {
    return this.client;
  }
}
