import { IsString, IsOptional, Matches } from 'class-validator';

export class CreatePipelineDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid hex color (e.g., #6366f1)',
  })
  color?: string;
}
