import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateEventTaskDto } from './dto/create-event-task.dto';
import { CreateEventBudgetItemDto } from './dto/create-event-budget-item.dto';

const MS_PER_DAY = 86_400_000;

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  // blueprint §17 EVENT AUTOMATION: instantiate the task timeline from
  // event_task_templates the moment the event is created, offsetting each
  // template's days_before_event against the chosen event_date.
  async create(customerId: string, dto: CreateEventDto) {
    const eventDate = new Date(dto.eventDate);

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          customerId,
          name: dto.name,
          eventType: dto.eventType,
          eventDate,
          city: dto.city,
          budgetTotal: dto.budgetTotal,
        },
      });

      const templates = await tx.eventTaskTemplate.findMany({
        where: { eventType: dto.eventType },
      });
      if (templates.length > 0) {
        await tx.eventTask.createMany({
          data: templates.map((template) => ({
            eventId: event.id,
            title: template.title,
            category: template.category,
            dueDate: new Date(
              eventDate.getTime() - template.daysBeforeEvent * MS_PER_DAY,
            ),
          })),
        });
      }

      return event;
    });
  }

  list(customerId: string) {
    return this.prisma.event.findMany({
      where: { customerId },
      orderBy: { eventDate: 'asc' },
    });
  }

  private async assertOwner(customerId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (event.customerId !== customerId) {
      throw new ForbiddenException('Not your event');
    }
    return event;
  }

  // blueprint §21: the Event Dashboard aggregate read model.
  async getDashboard(customerId: string, eventId: string) {
    const event = await this.assertOwner(customerId, eventId);

    const [tasks, budgetItems, bookings, orders] = await Promise.all([
      this.prisma.eventTask.findMany({
        where: { eventId },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.eventBudgetItem.findMany({ where: { eventId } }),
      this.prisma.booking.findMany({ where: { eventId } }),
      this.prisma.order.findMany({ where: { eventId } }),
    ]);

    const daysRemaining = Math.ceil(
      (event.eventDate.getTime() - Date.now()) / MS_PER_DAY,
    );

    return {
      event,
      daysRemaining,
      tasks,
      budgetItems,
      bookings,
      orders,
      // Rule-based recommendation stub (blueprint §18): wedding events with
      // no confirmed hall booking yet get nudged toward wedding halls.
      // Sprint 6 exit criteria — full personalization is a later phase.
      recommendedServices:
        event.eventType === 'wedding' &&
        !bookings.some((b) => b.status === 'confirmed')
          ? [{ hint: 'wedding_hall', reason: 'No hall booked yet' }]
          : [],
    };
  }

  async listTasks(customerId: string, eventId: string) {
    await this.assertOwner(customerId, eventId);
    return this.prisma.eventTask.findMany({
      where: { eventId },
      orderBy: { dueDate: 'asc' },
    });
  }

  async addTask(customerId: string, eventId: string, dto: CreateEventTaskDto) {
    await this.assertOwner(customerId, eventId);
    return this.prisma.eventTask.create({
      data: {
        eventId,
        title: dto.title,
        category: dto.category,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      },
    });
  }

  async listBudgetItems(customerId: string, eventId: string) {
    await this.assertOwner(customerId, eventId);
    return this.prisma.eventBudgetItem.findMany({ where: { eventId } });
  }

  async addBudgetItem(
    customerId: string,
    eventId: string,
    dto: CreateEventBudgetItemDto,
  ) {
    await this.assertOwner(customerId, eventId);
    return this.prisma.eventBudgetItem.create({
      data: {
        eventId,
        category: dto.category,
        plannedAmount: dto.plannedAmount,
      },
    });
  }
}
