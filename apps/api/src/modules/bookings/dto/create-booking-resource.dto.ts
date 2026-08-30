import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateBookingResourceDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsNumber()
  @Min(0)
  basePrice: number;
}
