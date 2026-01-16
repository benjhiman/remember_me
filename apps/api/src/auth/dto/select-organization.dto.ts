import { IsString } from 'class-validator';

export class SelectOrganizationDto {
  @IsString()
  organizationId!: string;
}
