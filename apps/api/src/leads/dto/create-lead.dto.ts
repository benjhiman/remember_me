import { IsString, IsOptional, IsDecimal, IsArray, IsObject, IsEmail, Matches, ValidateIf } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateLeadDto {
  @IsString()
  pipelineId!: string;

  @IsString()
  stageId!: string;

  @IsString()
  name!: string;

  @Transform(({ value }) => (value === '' ? undefined : value))
  @ValidateIf((o) => o.email !== undefined && o.email !== null && o.email !== '')
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsOptional()
  email?: string;

  @Transform(({ value }) => (value === '' ? undefined : value))
  @ValidateIf((o) => o.phone !== undefined && o.phone !== null && o.phone !== '')
  @IsString()
  @IsOptional()
  @Matches(/^[\d\s\+\-\(\)]+$/, {
    message: 'Phone number contains invalid characters',
  })
  phone?: string;

  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @IsOptional()
  source?: string;

  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @IsOptional()
  city?: string;

  @Type(() => Number)
  @IsDecimal()
  @IsOptional()
  budget?: number;

  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @IsOptional()
  model?: string;

  @IsObject()
  @IsOptional()
  customFields?: Record<string, any>;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  assignedToId?: string;
}
