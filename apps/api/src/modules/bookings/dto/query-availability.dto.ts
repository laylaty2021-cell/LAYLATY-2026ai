import { IsDateString } from 'class-validator';

export class QueryAvailabilityDto {
  @IsDateString()
  from: string;

  @IsDateString()
  to: string;
}
