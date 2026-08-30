import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string, unreadOnly: boolean) {
    return this.prisma.notification.findMany({
      where: { userId, readAt: unreadOnly ? null : undefined },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.userId !== userId)
      throw new ForbiddenException('Not your notification');

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date(), status: 'read' },
    });
  }

  // Called by other modules (Bookings, Payments, Events, ...) to queue a
  // notification. Sprint 11 wires the BullMQ consumer that actually
  // dispatches push/SMS/email; until then this just persists the row so
  // the in-app notification list works end-to-end.
  enqueue(userId: string, eventKey: string, payload: Record<string, unknown>) {
    return this.prisma.notification.create({
      data: {
        userId,
        channel: 'in_app',
        eventKey,
        payload: payload as Prisma.InputJsonValue,
        status: 'queued',
      },
    });
  }
}
