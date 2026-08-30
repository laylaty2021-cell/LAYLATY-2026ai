import { BusinessType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class SearchStoresDto {
  @IsOptional()
  @IsEnum(BusinessType)
  businessType?: BusinessType;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  q?: string;
}
