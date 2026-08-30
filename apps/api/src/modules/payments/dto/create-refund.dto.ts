import { IsNumber, IsString, IsUUID, Min } from 'class-validator';

export class CreateRefundDto {
  @IsUUID()
  paymentId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  reason: string;
}
