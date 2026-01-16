import { IsString, IsOptional, Matches } from 'class-validator';

export class CreateStageDto {
  @IsString()
  pipelineId!: string;

  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid hex color (e.g., #94a3b8)',
  })
  color?: string;
}
