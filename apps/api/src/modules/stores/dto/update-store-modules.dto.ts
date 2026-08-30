import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsString, ValidateNested } from 'class-validator';

class StoreModuleInput {
  @IsString()
  moduleKey: string;

  @IsBoolean()
  enabled: boolean;
}

export class UpdateStoreModulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StoreModuleInput)
  modules: StoreModuleInput[];
}
