import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { JwtPayload } from './types/jwt-payload.type';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth()
  logout(
    @CurrentUser() user: JwtPayload,
    @Body() body: { refreshToken?: string },
  ) {
    return this.auth.logout(user.sub, body?.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  me(@CurrentUser() user: JwtPayload) {
    return this.auth.getMe(user.sub);
  }

  /** Step 1: redirect browser to Google (requires GOOGLE_CLIENT_ID). */
  @Public()
  @Get('google')
  google(@Req() req: Request, @Res() res: Response) {
    const id = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!id) {
      return res.status(501).json({ message: 'Google OAuth not configured' });
    }
    const role =
      (req.query.role as string) === 'teacher'
        ? UserRole.teacher
        : UserRole.student;
    const callback =
      this.config.get<string>('GOOGLE_CALLBACK_URL') ?? '';
    const url =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      new URLSearchParams({
        client_id: id,
        redirect_uri: callback,
        response_type: 'code',
        scope: 'openid email profile',
        state: role,
      }).toString();
    return res.redirect(url);
  }

  /** Step 2: Google redirects here with ?code= — exchange code, issue JWTs, redirect to SPA. */
  @Public()
  @Get('google/callback')
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const frontendBase =
      this.config.get<string>('FRONTEND_OAUTH_REDIRECT') ??
      'http://localhost:5173/auth/callback';

    const oauthError = req.query.error as string | undefined;
    if (oauthError) {
      return res.redirect(
        `${frontendBase}?oauth_error=${encodeURIComponent(oauthError)}`,
      );
    }

    const code = req.query.code as string | undefined;
    if (!code) {
      return res.redirect(`${frontendBase}?oauth_error=no_code`);
    }

    const state = (req.query.state as string) || 'student';
    const role =
      state === UserRole.teacher ? UserRole.teacher : UserRole.student;

    try {
      const tokens = await this.auth.exchangeGoogleCode(code, role);
      const hash = new URLSearchParams({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_in: String(tokens.expiresIn ?? ''),
      }).toString();
      const target = `${frontendBase.replace(/\/$/, '')}#${hash}`;
      return res.redirect(302, target);
    } catch {
      return res.redirect(`${frontendBase}?oauth_error=exchange_failed`);
    }
  }
}
