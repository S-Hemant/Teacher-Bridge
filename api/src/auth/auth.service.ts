import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './types/jwt-payload.type';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private hashRefresh(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        role: dto.role,
        profile: {
          create: {
            displayName: dto.email.split('@')[0],
          },
        },
        ...(dto.role === UserRole.teacher
          ? {
              teacherProfile: {
                create: {},
              },
            }
          : {
              studentProfile: {
                create: {},
              },
            }),
      },
    });
    return this.issueTokens(user.id, user.email, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status !== 'active') {
      throw new UnauthorizedException('Account disabled');
    }
    return this.issueTokens(user.id, user.email, user.role);
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashRefresh(refreshToken);
    const record = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!record?.user) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    await this.prisma.refreshToken.delete({ where: { id: record.id } });
    return this.issueTokens(
      record.user.id,
      record.user.email,
      record.user.role,
    );
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      const tokenHash = this.hashRefresh(refreshToken);
      await this.prisma.refreshToken.deleteMany({
        where: { userId, tokenHash },
      });
    } else {
      await this.prisma.refreshToken.deleteMany({ where: { userId } });
    }
    return { ok: true };
  }

  private async issueTokens(userId: string, email: string, role: UserRole) {
    const payload: JwtPayload = { sub: userId, email, role };
    const accessToken = await this.jwt.signAsync(payload);
    const rawRefresh = randomBytes(48).toString('base64url');
    const tokenHash = this.hashRefresh(rawRefresh);
    const refreshDays = Number(
      this.config.get<string>('JWT_REFRESH_DAYS') ?? '7',
    );
    const expiresAt = new Date();
    expiresAt.setDate(
      expiresAt.getDate() + (Number.isFinite(refreshDays) && refreshDays > 0 ? refreshDays : 7),
    );

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES') ?? '15m',
    };
  }

  /** Exchange authorization code from Google redirect for app JWTs. */
  async exchangeGoogleCode(code: string, role: UserRole) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    const redirectUri = this.config.get<string>('GOOGLE_CALLBACK_URL');
    if (!clientId || !clientSecret || !redirectUri) {
      throw new UnauthorizedException('Google OAuth is not configured');
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      throw new UnauthorizedException(
        `Google token exchange failed: ${tokenRes.status} ${text}`,
      );
    }

    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenJson.access_token;
    if (!accessToken) {
      throw new UnauthorizedException('Google did not return an access token');
    }

    const userInfoRes = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!userInfoRes.ok) {
      const text = await userInfoRes.text();
      throw new UnauthorizedException(
        `Google userinfo failed: ${userInfoRes.status} ${text}`,
      );
    }

    const profile = (await userInfoRes.json()) as {
      sub: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    return this.validateGoogleUser({
      googleId: profile.sub,
      email: profile.email,
      displayName: profile.name,
      role,
    });
  }

  async validateGoogleUser(data: {
    googleId: string;
    email?: string;
    displayName?: string;
    role?: UserRole;
  }) {
    if (!data.email) {
      throw new UnauthorizedException('Google account has no email');
    }
    const email = data.email.toLowerCase();
    let user = await this.prisma.user.findFirst({
      where: { OR: [{ googleId: data.googleId }, { email }] },
    });
    const role = data.role ?? UserRole.student;

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email,
          googleId: data.googleId,
          role,
          profile: {
            create: {
              displayName: data.displayName ?? email.split('@')[0],
            },
          },
          ...(role === UserRole.teacher
            ? { teacherProfile: { create: {} } }
            : { studentProfile: { create: {} } }),
        },
      });
    } else if (!user.googleId) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId: data.googleId },
      });
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException('Account disabled');
    }

    return this.issueTokens(user.id, user.email, user.role);
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        teacherProfile: {
          include: {
            primarySubject: true,
            subjects: { include: { subject: true } },
            tags: { include: { tag: true } },
          },
        },
        studentProfile: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException();
    }
    const { passwordHash: _, ...rest } = user;
    return rest;
  }
}
