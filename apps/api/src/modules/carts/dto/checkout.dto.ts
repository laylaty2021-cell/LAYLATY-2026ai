import { IsOptional, IsUUID } from 'class-validator';

export class CheckoutDto {
  @IsUUID()
  storeId: string;

  @IsOptional()
  @IsUUID()
  shippingAddressId?: string;
}
