import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma/prisma.service';
import { TenantAccessService } from '../../common/access/tenant-access.service';
import { CreateBookingResourceDto } from './dto/create-booking-resource.dto';
import { QueryAvailabilityDto } from './dto/query-availability.dto';
import { CreateBookingHoldDto } from './dto/create-booking-hold.dto';
import { CreateAvailabilityRuleDto } from './dto/create-availability-rule.dto';
import {
  combineDateAndTime,
  Interval,
  subtractIntervals,
} from './availability.util';

const HOLD_TTL_MINUTES = 15;
const MAX_AVAILABILITY_DAYS = 60;

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TenantAccessService,
  ) {}

  async createResource(
    userId: string,
    storeId: string,
    dto: CreateBookingResourceDto,
  ) {
    await this.access.assertStoreAccess(userId, storeId);
    return this.prisma.bookingResource.create({
      data: {
        storeId,
        name: dto.name,
        description: dto.description,
        capacity: dto.capacity,
        basePrice: dto.basePrice,
      },
    });
  }

  async listResources(userId: string, storeId: string) {
    await this.access.assertStoreAccess(userId, storeId);
    return this.prisma.bookingResource.findMany({ where: { storeId } });
  }

  async addAvailabilityRule(
    userId: string,
    storeId: string,
    resourceId: string,
    dto: CreateAvailabilityRuleDto,
  ) {
    await this.access.assertStoreAccess(userId, storeId);
    const resource = await this.prisma.bookingResource.findUnique({
      where: { id: resourceId },
    });
    if (!resource || resource.storeId !== storeId) {
      throw new NotFoundException('Resource not found');
    }
    return this.prisma.resourceAvailabilityRule.create({
      data: {
        resourceId,
        dayOfWeek: dto.dayOfWeek,
        startTime: new Date(`1970-01-01T${dto.startTime}:00Z`),
        endTime: new Date(`1970-01-01T${dto.endTime}:00Z`),
      },
    });
  }

  // blueprint §11 / sprint 7: free slots = weekly availability rules minus
  // blackout dates minus existing held/confirmed bookings.
  async getAvailability(resourceId: string, dto: QueryAvailabilityDto) {
    const resource = await this.prisma.bookingResource.findUnique({
      where: { id: resourceId },
    });
    if (!resource) throw new NotFoundException('Resource not found');

    const now = new Date();
    const requestedFrom = new Date(dto.from);
    const from = requestedFrom < now ? now : requestedFrom;
    const to = new Date(dto.to);
    if (to <= from) throw new BadRequestException('`to` must be after `from`');
    const spanDays = Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
    if (spanDays > MAX_AVAILABILITY_DAYS) {
      throw new BadRequestException(
        `Range too wide — max ${MAX_AVAILABILITY_DAYS} days per query`,
      );
    }

    const [rules, blackouts, bookings] = await Promise.all([
      this.prisma.resourceAvailabilityRule.findMany({ where: { resourceId } }),
      this.prisma.resourceBlackoutDate.findMany({
        where: { resourceId, startsAt: { lt: to }, endsAt: { gt: from } },
      }),
      this.prisma.booking.findMany({
        where: {
          resourceId,
          status: { in: ['held', 'confirmed'] },
          startsAt: { lt: to },
          endsAt: { gt: from },
        },
      }),
    ]);

    const exclusions: Interval[] = [
      ...blackouts.map((b) => ({ start: b.startsAt, end: b.endsAt })),
      ...bookings.map((b) => ({ start: b.startsAt, end: b.endsAt })),
    ];

    const freeSlots: Interval[] = [];
    for (
      let day = new Date(
        Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
      );
      day < to;
      day.setUTCDate(day.getUTCDate() + 1)
    ) {
      const dayOfWeek = day.getUTCDay();
      const todaysRules = rules.filter((r) => r.dayOfWeek === dayOfWeek);
      const baseIntervals: Interval[] = todaysRules.map((rule) => ({
        start: combineDateAndTime(day, rule.startTime),
        end: combineDateAndTime(day, rule.endTime),
      }));
      const clamped = baseIntervals
        .map((interval) => ({
          start: interval.start < from ? from : interval.start,
          end: interval.end > to ? to : interval.end,
        }))
        .filter((i) => i.end > i.start);

      freeSlots.push(...subtractIntervals(clamped, exclusions));
    }

    return freeSlots.map((slot) => ({
      startsAt: slot.start.toISOString(),
      endsAt: slot.end.toISOString(),
    }));
  }

  // blueprint §11: create a temporary hold atomically. Availability is
  // NOT checked with a separate SELECT — the INSERT itself is the check,
  // enforced by the excl_bookings_no_overlap EXCLUDE constraint
  // (docs/database/erd.md §4). Two concurrent requests for the same slot
  // race at the database level; exactly one wins.
  async createHold(customerId: string, dto: CreateBookingHoldDto) {
    const resource = await this.prisma.bookingResource.findUnique({
      where: { id: dto.resourceId },
    });
    if (!resource) throw new NotFoundException('Resource not found');

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) {
      throw new BadRequestException('endsAt must be after startsAt');
    }

    const durationHours = (endsAt.getTime() - startsAt.getTime()) / 3_600_000;
    const totalPrice = Number(resource.basePrice) * Math.max(durationHours, 1);

    try {
      return await this.prisma.booking.create({
        data: {
          resourceId: dto.resourceId,
          customerId,
          eventId: dto.eventId,
          startsAt,
          endsAt,
          status: 'held',
          holdExpiresAt: new Date(Date.now() + HOLD_TTL_MINUTES * 60_000),
          totalPrice,
          currency: resource.currency,
        },
      });
    } catch (error) {
      if (this.isOverlapViolation(error)) {
        throw new ConflictException(
          'This slot was just taken — please choose another time',
        );
      }
      throw error;
    }
  }

  private isOverlapViolation(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('excl_bookings_no_overlap');
  }

  async cancel(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.customerId !== userId) {
      throw new ForbiddenException('Not your booking');
    }
    if (!['held', 'confirmed'].includes(booking.status)) {
      throw new BadRequestException(
        `Cannot cancel a ${booking.status} booking`,
      );
    }
    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'cancelled', holdExpiresAt: null },
    });
  }

  // Sprint 8 (S8.2): sweep expired holds every minute so an abandoned hold
  // frees its slot instead of blocking the resource forever.
  @Cron(CronExpression.EVERY_MINUTE)
  async expireStaleHolds() {
    const { count } = await this.prisma.booking.updateMany({
      where: { status: 'held', holdExpiresAt: { lt: new Date() } },
      data: { status: 'expired', holdExpiresAt: null },
    });
    if (count > 0) {
      this.logger.log(`Expired ${count} stale booking hold(s)`);
    }
  }
}
