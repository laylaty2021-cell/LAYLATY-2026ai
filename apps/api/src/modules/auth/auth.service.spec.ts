import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';

// Unit-level: PrismaService and JwtService are mocked so this runs without
// a database, complementing the real end-to-end flow in
// test/auth.e2e-spec.ts (which does exercise a live Postgres instance).
describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findFirst: jest.Mock;
      create: jest.Mock;
    };
    otpCode: {
      create: jest.Mock;
    };
  };
  let config: ConfigService;

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      otpCode: {
        create: jest.fn(),
      },
    };
    config = new ConfigService({
      jwt: {
        accessSecret: 'test-secret',
        accessTtl: '15m',
        refreshSecret: 'test-refresh-secret',
        refreshTtlDays: 30,
      },
    });
    service = new AuthService(
      prisma as unknown as PrismaService,
      new JwtService(),
      config,
    );
  });

  describe('register', () => {
    it('rejects registration when the email is already taken', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'existing-user' });

      await expect(
        service.register({
          fullName: 'Jane Doe',
          email: 'jane@example.com',
          password: 'CorrectHorseBattery9',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('creates a pending_verification user and issues an OTP when the email is free', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'new-user-id' });
      prisma.otpCode.create.mockResolvedValue({});

      const result = await service.register({
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        password: 'CorrectHorseBattery9',
      });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'pending_verification' }),
        }),
      );
      expect(prisma.otpCode.create).toHaveBeenCalled();
      expect(result.userId).toBe('new-user-id');
      // Outside of NODE_ENV=production, the OTP is surfaced for testability.
      expect(result.otpDebug).toMatch(/^\d{6}$/);
    });
  });

  describe('refresh', () => {
    it('rejects a malformed refresh token', async () => {
      await expect(service.refresh('not-a-valid-token')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });
});
