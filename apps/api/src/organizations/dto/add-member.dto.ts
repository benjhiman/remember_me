import { IsEmail, IsEnum } from 'class-validator';
import { Role } from '@remember-me/prisma';

export class AddMemberDto {
  @IsEmail()
  email!: string;

  @IsEnum(Role)
  role!: Role;
}
