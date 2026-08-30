import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreatePaymentDto {
  @IsIn(['order', 'booking'])
  targetType: 'order' | 'booking';

  @IsUUID()
  targetId: string;

  @IsString()
  provider: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsString()
  idempotencyKey: string;
}
