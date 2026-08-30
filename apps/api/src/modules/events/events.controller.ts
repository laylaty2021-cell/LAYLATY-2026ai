import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { CreateEventTaskDto } from './dto/create-event-task.dto';
import { CreateEventBudgetItemDto } from './dto/create-event-budget-item.dto';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEventDto) {
    return this.eventsService.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.eventsService.list(user.id);
  }

  @Get(':eventId')
  getDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId') eventId: string,
  ) {
    return this.eventsService.getDashboard(user.id, eventId);
  }

  @Get(':eventId/tasks')
  listTasks(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId') eventId: string,
  ) {
    return this.eventsService.listTasks(user.id, eventId);
  }

  @Post(':eventId/tasks')
  addTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId') eventId: string,
    @Body() dto: CreateEventTaskDto,
  ) {
    return this.eventsService.addTask(user.id, eventId, dto);
  }

  @Get(':eventId/budget-items')
  listBudgetItems(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId') eventId: string,
  ) {
    return this.eventsService.listBudgetItems(user.id, eventId);
  }

  @Post(':eventId/budget-items')
  addBudgetItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('eventId') eventId: string,
    @Body() dto: CreateEventBudgetItemDto,
  ) {
    return this.eventsService.addBudgetItem(user.id, eventId, dto);
  }
}
