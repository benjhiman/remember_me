import { IsEnum } from 'class-validator';
import { Role } from '@remember-me/prisma';

export class UpdateMemberRoleDto {
  @IsEnum(Role)
  role!: Role;
}
