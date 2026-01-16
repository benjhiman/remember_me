import { IsString, IsOptional, Matches } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Organization slug can only contain lowercase letters, numbers, and hyphens',
  })
  slug?: string;
}
