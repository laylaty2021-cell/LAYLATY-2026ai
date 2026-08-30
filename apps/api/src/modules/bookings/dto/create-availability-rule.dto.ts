import { IsInt, IsMilitaryTime, Max, Min } from 'class-validator';

export class CreateAvailabilityRuleDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsMilitaryTime()
  startTime: string;

  @IsMilitaryTime()
  endTime: string;
}
