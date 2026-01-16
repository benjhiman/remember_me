import { Role } from '@remember-me/prisma';

export class OrganizationInfoDto {
  id!: string;
  name!: string;
  slug!: string;
  role!: Role;
}

export class LoginResponseDto {
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
    organizationId: string;
    organizationName: string;
    role: Role;
  };
  organizations?: OrganizationInfoDto[]; // Cuando el usuario tiene múltiples orgs
  requiresOrgSelection?: boolean;
  tempToken?: string; // Token temporal para selección de organización
}
