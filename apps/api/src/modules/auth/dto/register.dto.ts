import { UserType } from '@prisma/client';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

// 'admin' is deliberately excluded from self-registration — admin access
// is granted out-of-band via admin_user_roles (see prisma/seed.ts and
// AdminGuard), never chosen by the registering client. Accepting an
// arbitrary UserType here would let anyone self-escalate by POSTing
// {"userType": "admin"}.
const SELF_REGISTERABLE_USER_TYPES: UserType[] = ['customer', 'merchant'];

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
  @IsIn(SELF_REGISTERABLE_USER_TYPES)
  userType?: UserType;
}
