import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

// Exercises the Sprint 1 exit criteria (docs/backlog/sprint-backlog.md):
// register -> OTP verify -> login -> refresh -> access a protected route,
// against a real Postgres instance (set DATABASE_URL before running).
describe('Auth flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `e2e-${Date.now()}@laylaty.test`;
  const password = 'CorrectHorseBattery9';

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('registers, verifies OTP, logs in, refreshes, and calls /users/me', async () => {
    const registerRes = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ fullName: 'E2E Test', email, password })
      .expect(201);

    expect(registerRes.body.otpDebug).toMatch(/^\d{6}$/);

    await request(app.getHttpServer())
      .post('/v1/auth/otp/verify')
      .send({
        identifier: email,
        code: registerRes.body.otpDebug,
        purpose: 'register',
      })
      .expect(201);

    const loginRes = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ identifier: email, password })
      .expect(200);

    expect(loginRes.body.accessToken).toBeDefined();
    expect(loginRes.body.refreshToken).toBeDefined();

    const meRes = await request(app.getHttpServer())
      .get('/v1/users/me')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .expect(200);
    expect(meRes.body.email).toBe(email);

    const refreshRes = await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken })
      .expect(200);
    expect(refreshRes.body.accessToken).toBeDefined();

    // The rotated (old) refresh token must no longer work.
    await request(app.getHttpServer())
      .post('/v1/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken })
      .expect(401);
  });

  it('rejects a second registration with the same email', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ fullName: 'Duplicate', email, password })
      .expect(409);
  });
});
