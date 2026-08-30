import { IsOptional, IsString } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  commercialRegistration?: string;

  @IsOptional()
  @IsString()
  taxNumber?: string;
}
