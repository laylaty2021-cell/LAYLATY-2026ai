import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import {
  PAYMENT_PROVIDER,
  PaymentProvider,
} from '../integrations/payments/payment-provider.interface';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateRefundDto } from './dto/create-refund.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  // Idempotent by design (blueprint §12/§28): a retried request with the
  // same idempotencyKey returns the already-created payment instead of
  // creating a second one.
  async createPayment(dto: CreatePaymentDto) {
    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (existing) return existing;

    await this.assertTargetExists(dto.targetType, dto.targetId);

    const payment = await this.prisma.payment.create({
      data: {
        targetType: dto.targetType,
        targetId: dto.targetId,
        provider: dto.provider,
        amount: dto.amount,
        currency: dto.currency ?? 'SAR',
        idempotencyKey: dto.idempotencyKey,
        status: 'pending',
      },
    });

    const { providerPaymentId, checkoutUrl } =
      await this.provider.createPayment({
        amount: dto.amount,
        currency: payment.currency,
        idempotencyKey: dto.idempotencyKey,
        metadata: { targetType: dto.targetType, targetId: dto.targetId },
      });

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { providerPaymentId },
    });

    return { ...updated, checkoutUrl };
  }

  private async assertTargetExists(targetType: string, targetId: string) {
    if (targetType === 'order') {
      const order = await this.prisma.order.findUnique({
        where: { id: targetId },
      });
      if (!order) throw new NotFoundException('Order not found');
    } else {
      const booking = await this.prisma.booking.findUnique({
        where: { id: targetId },
      });
      if (!booking) throw new NotFoundException('Booking not found');
    }
  }

  // The ONLY path that marks a payment/order/booking as paid (blueprint
  // §12 "مهم"). Idempotent via the (provider, event_id) unique constraint
  // on payment_webhook_events — a duplicated delivery from the provider is
  // a no-op, checked and marked processed inside the same transaction that
  // does the settling, so a crash mid-processing is retried, not skipped.
  async handleWebhook(
    providerName: string,
    payload: unknown,
    signatureHeader: string | undefined,
  ) {
    const verification = this.provider.verifyWebhook({
      payload,
      signatureHeader,
    });
    if (!verification.valid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    return this.prisma.$transaction(async (tx) => {
      const existingEvent = await tx.paymentWebhookEvent.findUnique({
        where: {
          provider_eventId: {
            provider: providerName,
            eventId: verification.eventId,
          },
        },
      });
      if (existingEvent?.processedAt) {
        return { acknowledged: true, alreadyProcessed: true };
      }

      const event =
        existingEvent ??
        (await tx.paymentWebhookEvent.create({
          data: {
            provider: providerName,
            eventId: verification.eventId,
            eventType: verification.eventType,
            payload: payload as Prisma.InputJsonValue,
          },
        }));

      const payment = await tx.payment.findFirst({
        where: { providerPaymentId: verification.providerPaymentId },
      });
      if (!payment) {
        // Nothing to settle against (e.g. a stray/replayed test event) —
        // still mark processed so we never loop on it.
        await tx.paymentWebhookEvent.update({
          where: { id: event.id },
          data: { processedAt: new Date() },
        });
        return { acknowledged: true, matched: false };
      }

      if (verification.status === 'succeeded') {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'succeeded' },
        });
        await this.settleTarget(tx, payment.targetType, payment.targetId);
      } else {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'failed' },
        });
      }

      await tx.paymentWebhookEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      });

      return { acknowledged: true, matched: true };
    });
  }

  private async settleTarget(
    tx: Prisma.TransactionClient,
    targetType: string,
    targetId: string,
  ) {
    if (targetType === 'order') {
      await tx.order.update({
        where: { id: targetId },
        data: { status: 'paid' },
      });

      const orderItems = await tx.orderItem.findMany({
        where: { orderId: targetId },
      });
      for (const item of orderItems) {
        if (item.variantId) {
          await this.inventory.confirm(tx, 'order_item', item.id);
        }
        if (item.bookingId) {
          await tx.booking.update({
            where: { id: item.bookingId },
            data: { status: 'confirmed', holdExpiresAt: null },
          });
        }
      }
    } else {
      await tx.booking.update({
        where: { id: targetId },
        data: { status: 'confirmed', holdExpiresAt: null },
      });
    }
  }

  async createRefund(actorId: string, dto: CreateRefundDto) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: dto.paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (
      payment.status !== 'succeeded' &&
      payment.status !== 'partially_refunded'
    ) {
      throw new BadRequestException('Only a succeeded payment can be refunded');
    }
    if (dto.amount > Number(payment.amount)) {
      throw new BadRequestException('Refund amount exceeds payment amount');
    }

    await this.provider.refundPayment(
      payment.providerPaymentId ?? '',
      dto.amount,
    );

    return this.prisma.$transaction(async (tx) => {
      const refund = await tx.refund.create({
        data: {
          paymentId: payment.id,
          amount: dto.amount,
          reason: dto.reason,
          status: 'succeeded',
          requestedBy: actorId,
        },
      });

      const isFullRefund = dto.amount === Number(payment.amount);
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: isFullRefund ? 'refunded' : 'partially_refunded' },
      });

      // blueprint §25 AUDIT SYSTEM: who / what / when for every financial action.
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'payment.refund',
          entityType: 'payment',
          entityId: payment.id,
          beforeState: { status: payment.status } as Prisma.InputJsonValue,
          afterState: {
            status: isFullRefund ? 'refunded' : 'partially_refunded',
            refundAmount: dto.amount,
          } as Prisma.InputJsonValue,
        },
      });

      return refund;
    });
  }
}
