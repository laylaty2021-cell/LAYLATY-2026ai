import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

// End-to-end walk across nearly every module built on top of Sprint 1's
// auth: onboarding a merchant, publishing a service and a booking
// resource, a customer planning an event, browsing the catalog, booking a
// slot, checking out, and settling payment via the (mock) webhook path —
// mirroring the MVP scope in docs/backlog/sprint-backlog.md end to end.
describe('Full platform flow (e2e)', () => {
  let app: INestApplication;
  const suffix = Date.now();
  const merchantEmail = `merchant-${suffix}@laylaty.test`;
  const customerEmail = `customer-${suffix}@laylaty.test`;
  const password = 'CorrectHorseBattery9';

  let merchantToken: string;
  let customerToken: string;
  let organizationId: string;
  let storeId: string;
  let resourceId: string;
  let serviceId: string;

  async function registerAndLogin(email: string, fullName: string) {
    const registerRes = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ fullName, email, password })
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

    return loginRes.body.accessToken as string;
  }

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

    merchantToken = await registerAndLogin(merchantEmail, 'Merchant Owner');
    customerToken = await registerAndLogin(customerEmail, 'Happy Customer');
  });

  afterAll(async () => {
    // Not deleting the created users here: this flow fans out into orgs,
    // stores, bookings, orders, and payments with mostly RESTRICT foreign
    // keys, so a correct teardown would need to unwind every table in
    // dependency order. The timestamped email suffix keeps reruns
    // collision-free, so we just leave the fixtures — this is a throwaway
    // test database, not one anyone reads reports off of.
    await app.close();
  });

  it('onboards a merchant: organization -> store -> service -> booking resource', async () => {
    const orgRes = await request(app.getHttpServer())
      .post('/v1/organizations')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ name: 'Test Photography Studio' })
      .expect(201);
    organizationId = orgRes.body.id;

    const storeRes = await request(app.getHttpServer())
      .post('/v1/stores')
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({
        organizationId,
        name: 'Studio Laylaty',
        slug: `studio-laylaty-${suffix}`,
        businessType: 'photographer',
      })
      .expect(201);
    storeId = storeRes.body.id;
    expect(storeRes.body.status).toBe('pending_review');

    // Merchant dashboard landing queries: "my orgs" and "my stores" must
    // surface this org/store even though the store isn't public yet.
    const myOrgsRes = await request(app.getHttpServer())
      .get('/v1/organizations')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200);
    expect(myOrgsRes.body.map((o: { id: string }) => o.id)).toContain(
      organizationId,
    );

    const myStoresRes = await request(app.getHttpServer())
      .get('/v1/merchant/stores')
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200);
    expect(myStoresRes.body.map((s: { id: string }) => s.id)).toContain(
      storeId,
    );

    // Default Business Template modules for a photographer (blueprint §9).
    const modulesRes = await request(app.getHttpServer())
      .get(`/v1/merchant/stores/${storeId}/modules`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .expect(200);
    expect(
      modulesRes.body.map((m: { moduleKey: string }) => m.moduleKey),
    ).toEqual(
      expect.arrayContaining(['services', 'booking', 'calendar', 'packages']),
    );

    const serviceRes = await request(app.getHttpServer())
      .post(`/v1/merchant/stores/${storeId}/services`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({
        name: 'Wedding Photography Package',
        slug: `wedding-photography-${suffix}`,
        price: 3000,
        durationMinutes: 240,
      })
      .expect(201);
    serviceId = serviceRes.body.id;

    const resourceRes = await request(app.getHttpServer())
      .post(`/v1/merchant/stores/${storeId}/booking-resources`)
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({ name: 'Main Studio', capacity: 20, basePrice: 500 })
      .expect(201);
    resourceId = resourceRes.body.id;

    await request(app.getHttpServer())
      .post(
        `/v1/merchant/stores/${storeId}/booking-resources/${resourceId}/availability-rules`,
      )
      .set('Authorization', `Bearer ${merchantToken}`)
      .send({
        dayOfWeek: new Date().getUTCDay(),
        startTime: '09:00',
        endTime: '18:00',
      })
      .expect(201);
  });

  it('a customer cannot manage a store they do not belong to', async () => {
    await request(app.getHttpServer())
      .post(`/v1/merchant/stores/${storeId}/services`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Hijacked', slug: `hijacked-${suffix}`, price: 1 })
      .expect(403);
  });

  it('customer plans an event and sees it on the dashboard', async () => {
    const eventDate = new Date();
    eventDate.setUTCDate(eventDate.getUTCDate() + 30);

    const eventRes = await request(app.getHttpServer())
      .post('/v1/events')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        name: 'Our Wedding',
        eventType: 'wedding',
        eventDate: eventDate.toISOString().slice(0, 10),
        budgetTotal: 50000,
      })
      .expect(201);

    const dashboardRes = await request(app.getHttpServer())
      .get(`/v1/events/${eventRes.body.id}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);

    expect(dashboardRes.body.event.id).toBe(eventRes.body.id);
    expect(dashboardRes.body.daysRemaining).toBeGreaterThan(25);
    // No hall booking yet -> the rule-based recommendation nudge fires.
    expect(dashboardRes.body.recommendedServices).toHaveLength(1);
  });

  it('finds an available slot, holds it, and rejects an overlapping hold', async () => {
    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const to = new Date(today.getTime() + 6 * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const availabilityRes = await request(app.getHttpServer())
      .get(`/v1/booking-resources/${resourceId}/availability`)
      .query({ from, to })
      .expect(200);
    expect(availabilityRes.body.length).toBeGreaterThan(0);

    const slot = availabilityRes.body[0];

    const holdRes = await request(app.getHttpServer())
      .post('/v1/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ resourceId, startsAt: slot.startsAt, endsAt: slot.endsAt })
      .expect(201);
    expect(holdRes.body.status).toBe('held');

    // Same exact slot, second customer (well, same token here) — must be
    // rejected by the DB-level exclusion constraint, not silently allowed.
    await request(app.getHttpServer())
      .post('/v1/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ resourceId, startsAt: slot.startsAt, endsAt: slot.endsAt })
      .expect(409);
  });

  it('adds a service to the cart, checks out, pays, and the order settles', async () => {
    await request(app.getHttpServer())
      .post('/v1/cart/items')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ storeId, itemType: 'service', itemId: serviceId, quantity: 1 })
      .expect(201);

    const orderRes = await request(app.getHttpServer())
      .post('/v1/cart/checkout')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ storeId })
      .expect(201);
    expect(orderRes.body.status).toBe('pending_payment');
    expect(Number(orderRes.body.totalAmount)).toBe(3000);

    const idempotencyKey = `test-${suffix}`;
    const paymentRes = await request(app.getHttpServer())
      .post('/v1/payments')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        targetType: 'order',
        targetId: orderRes.body.id,
        provider: 'mock',
        amount: 3000,
        idempotencyKey,
      })
      .expect(201);
    expect(paymentRes.body.checkoutUrl).toContain('mock-gateway');

    // A retried create-payment call with the same idempotency key must not
    // create a second payment (blueprint §12/§28).
    const repeatRes = await request(app.getHttpServer())
      .post('/v1/payments')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        targetType: 'order',
        targetId: orderRes.body.id,
        provider: 'mock',
        amount: 3000,
        idempotencyKey,
      })
      .expect(201);
    expect(repeatRes.body.id).toBe(paymentRes.body.id);

    const webhookPayload = {
      eventId: `evt_${suffix}`,
      eventType: 'payment.succeeded',
      providerPaymentId: paymentRes.body.providerPaymentId,
      status: 'succeeded',
    };

    await request(app.getHttpServer())
      .post('/v1/payments/webhooks/mock')
      .set('x-webhook-signature', 'mock-signature')
      .send(webhookPayload)
      .expect(200);

    // Replaying the exact same webhook event must be a no-op, not a
    // second settlement.
    const replayRes = await request(app.getHttpServer())
      .post('/v1/payments/webhooks/mock')
      .set('x-webhook-signature', 'mock-signature')
      .send(webhookPayload)
      .expect(200);
    expect(replayRes.body.alreadyProcessed).toBe(true);

    const finalOrder = await request(app.getHttpServer())
      .get(`/v1/orders/${orderRes.body.id}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200);
    expect(finalOrder.body.status).toBe('paid');
  });
});
