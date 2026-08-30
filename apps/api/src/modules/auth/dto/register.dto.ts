import { UserType } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  fullName: string;

  @ValidateIf((dto: RegisterDto) => !dto.phone)
  @IsEmail()
  email?: string;

  @ValidateIf((dto: RegisterDto) => !dto.email)
  @IsString()
  phone?: string;

  @MinLength(8)
  password: string;

  @IsOptional()
  @IsEnum(UserType)
  userType?: UserType;
}
