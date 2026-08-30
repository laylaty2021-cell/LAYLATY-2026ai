import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AccessTokenPayload } from './auth.types';

const BCRYPT_ROUNDS = 12;
const OTP_TTL_MINUTES = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // Sprint 1 (docs/backlog/sprint-backlog.md S1.1): register + OTP verify.
  // Real SMS/email delivery is wired in Sprint 11 via the Notification
  // module worker; until then the OTP is returned directly outside of
  // production so the flow is testable end-to-end.
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          dto.email ? { email: dto.email } : undefined,
          dto.phone ? { phone: dto.phone } : undefined,
        ].filter(Boolean) as object[],
      },
    });
    if (existing) {
      throw new ConflictException('Email or phone already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        userType: dto.userType ?? 'customer',
        status: 'pending_verification',
      },
    });

    const otp = await this.issueOtp(dto.email ?? dto.phone!, 'register');
    return {
      userId: user.id,
      otpDebug: process.env.NODE_ENV === 'production' ? undefined : otp,
    };
  }

  async verifyOtp(identifier: string, code: string, purpose: string) {
    const candidates = await this.prisma.otpCode.findMany({
      where: { identifier, consumedAt: null, purpose },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const now = new Date();
    for (const candidate of candidates) {
      if (candidate.expiresAt < now) continue;
      const matches = await bcrypt.compare(code, candidate.codeHash);
      if (!matches) continue;

      await this.prisma.otpCode.update({
        where: { id: candidate.id },
        data: { consumedAt: now },
      });

      if (purpose === 'register') {
        await this.prisma.user.updateMany({
          where: { OR: [{ email: identifier }, { phone: identifier }] },
          data: { status: 'active' },
        });
      }
      return { verified: true };
    }

    throw new UnauthorizedException('Invalid or expired OTP');
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.identifier }, { phone: dto.identifier }] },
    });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches)
      throw new UnauthorizedException('Invalid credentials');

    if (user.status !== 'active') {
      throw new UnauthorizedException(`Account is ${user.status}`);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokenPair(user.id, user.userType);
  }

  async refresh(refreshToken: string) {
    const [userId, secret] = refreshToken.split('.');
    if (!userId || !secret)
      throw new UnauthorizedException('Invalid refresh token');

    const candidates = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    });

    const match = await this.findMatchingToken(candidates, secret);
    if (!match)
      throw new UnauthorizedException(
        'Refresh token invalid, expired, or revoked',
      );

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    // Rotate: revoke the used token before issuing a new pair.
    await this.prisma.refreshToken.update({
      where: { id: match.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(user.id, user.userType);
  }

  async logout(userId: string, refreshToken: string) {
    const [tokenUserId, secret] = refreshToken.split('.');
    if (tokenUserId !== userId) return;

    const candidates = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null },
    });
    const match = await this.findMatchingToken(candidates, secret);
    if (match) {
      await this.prisma.refreshToken.update({
        where: { id: match.id },
        data: { revokedAt: new Date() },
      });
    }
  }

  private async findMatchingToken(
    candidates: { id: string; tokenHash: string }[],
    secret: string,
  ) {
    for (const candidate of candidates) {
      if (await bcrypt.compare(secret, candidate.tokenHash)) return candidate;
    }
    return null;
  }

  private async issueOtp(identifier: string, purpose: string) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await bcrypt.hash(code, BCRYPT_ROUNDS);
    await this.prisma.otpCode.create({
      data: {
        identifier,
        codeHash,
        purpose,
        expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
      },
    });
    return code;
  }

  private async issueTokenPair(userId: string, userType: string) {
    const payload: AccessTokenPayload = {
      sub: userId,
      userType: userType as never,
    };
    const accessToken = this.jwt.sign(payload, {
      secret: this.config.get('jwt.accessSecret'),
      expiresIn: this.config.get('jwt.accessTtl'),
    });

    const secret = randomBytes(32).toString('hex');
    const refreshToken = `${userId}.${secret}`;
    const tokenHash = await bcrypt.hash(secret, BCRYPT_ROUNDS);
    const refreshTtlDays = this.config.get<number>('jwt.refreshTtlDays')!;

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + refreshTtlDays * 86_400_000),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseTtlToSeconds(this.config.get('jwt.accessTtl')),
    };
  }

  private parseTtlToSeconds(ttl: string): number {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match) return 900;
    const value = Number(match[1]);
    const unit = { s: 1, m: 60, h: 3600, d: 86400 }[match[2]]!;
    return value * unit;
  }
}
