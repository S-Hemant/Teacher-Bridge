import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { HealthModule } from './health/health.module';
import { MatchingModule } from './matching/matching.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { StudentsModule } from './students/students.module';
import { TeachersModule } from './teachers/teachers.module';
import { VoiceModule } from './voice/voice.module';

function redisConnection(config: ConfigService) {
  const url = config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379';
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port || 6379),
      password: u.password || undefined,
      username: u.username || undefined,
    };
  } catch {
    return { host: '127.0.0.1', port: 6379 };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisConnection(config),
      }),
    }),
    PrismaModule,
    StorageModule,
    MatchingModule,
    AuthModule,
    TeachersModule,
    StudentsModule,
    VoiceModule,
    HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
