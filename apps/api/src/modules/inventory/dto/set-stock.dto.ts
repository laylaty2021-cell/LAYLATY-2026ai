import { IsInt, IsUUID, Min } from 'class-validator';

export class SetStockDto {
  @IsUUID()
  variantId: string;

  @IsUUID()
  locationId: string;

  @IsInt()
  @Min(0)
  quantityOnHand: number;
}
