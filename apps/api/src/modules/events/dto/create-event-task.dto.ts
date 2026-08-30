import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateEventTaskDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
