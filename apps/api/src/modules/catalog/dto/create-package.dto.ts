import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

class PackageItemInput {
  @IsIn(['product', 'service', 'booking'])
  itemType: 'product' | 'service' | 'booking';

  @IsUUID()
  itemId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class CreatePackageDto {
  @IsString()
  name: string;

  @Matches(/^[a-z0-9-]+$/)
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PackageItemInput)
  items: PackageItemInput[];
}
