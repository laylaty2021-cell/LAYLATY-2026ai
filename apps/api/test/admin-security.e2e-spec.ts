import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';

// Regression coverage for a real privilege-escalation bug fixed alongside
// AdminGuard's rewrite: RegisterDto used to accept an arbitrary UserType,
// so POSTing {"userType": "admin"} plus the old "userType === 'admin'"
// check in AdminGuard would have granted admin access to anyone who asked
// for it. Admin access now only ever comes from an admin_user_roles row
// (see prisma/seed.ts), which nothing reachable over the API can create.
describe('Admin access control (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const suffix = Date.now();
  const email = `plain-user-${suffix}@laylaty.test`;
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

  it('rejects self-registration with userType "admin"', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ fullName: 'Would-be Admin', email, password, userType: 'admin' })
      .expect(400);
  });

  it('rejects a plain registered user from every admin endpoint', async () => {
    const registerRes = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ fullName: 'Plain User', email, password })
      .expect(201);

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
    const token = loginRes.body.accessToken as string;

    await request(app.getHttpServer())
      .get('/v1/admin/organizations')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/v1/admin/refunds')
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentId: '00000000-0000-0000-0000-000000000000',
        amount: 1,
        reason: 'test',
      })
      .expect(403);
  });
});
