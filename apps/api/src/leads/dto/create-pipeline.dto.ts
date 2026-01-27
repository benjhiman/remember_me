import { IsString, IsOptional, Matches, IsArray, ValidateNested, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateStageInPipelineDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid hex color (e.g., #6366f1)',
  })
  color?: string;
}

export class CreatePipelineDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Color must be a valid hex color (e.g., #6366f1)',
  })
  color?: string;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateStageInPipelineDto)
  stages?: CreateStageInPipelineDto[];
}
