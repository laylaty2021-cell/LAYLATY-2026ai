import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateBookingHoldDto {
  @IsUUID()
  resourceId: string;

  @IsOptional()
  @IsUUID()
  eventId?: string;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;
}
