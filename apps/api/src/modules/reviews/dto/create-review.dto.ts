import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @IsOptional()
  @IsIn(['product', 'service', 'booking', 'package'])
  itemType?: 'product' | 'service' | 'booking' | 'package';

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsUUID()
  orderId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;
}
