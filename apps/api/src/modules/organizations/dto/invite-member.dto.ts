import { IsEmail, IsIn } from 'class-validator';

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsIn(['manager', 'staff', 'accountant'])
  role: 'manager' | 'staff' | 'accountant';
}
