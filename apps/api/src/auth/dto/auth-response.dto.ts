import { Role } from '@remember-me/prisma';

export class AuthResponseDto {
  accessToken!: string;
  refreshToken!: string;
  user!: {
    id: string;
    email: string;
    name: string | null;
    organizationId: string;
    organizationName: string;
    role: Role;
  };
}
