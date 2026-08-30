import { IsIn, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class AddCartItemDto {
  @IsUUID()
  storeId: string;

  @IsIn(['product', 'service', 'package'])
  itemType: 'product' | 'service' | 'package';

  @IsUUID()
  itemId: string;

  @IsOptional()
  @IsUUID()
  variantId?: string;

  @IsOptional()
  @IsUUID()
  bookingId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}
