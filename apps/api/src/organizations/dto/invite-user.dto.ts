import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { Role } from '@remember-me/prisma';

export class InviteUserDto {
  @IsEmail()
  email!: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  expiresInDays?: number; // Default 7 days
}
