import { IsNumber, IsString, Min } from 'class-validator';

export class CreateEventBudgetItemDto {
  @IsString()
  category: string;

  @IsNumber()
  @Min(0)
  plannedAmount: number;
}
