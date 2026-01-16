import { IsString, IsOptional, IsDecimal, IsArray, IsObject, IsEnum, IsEmail, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { LeadStatus } from '@remember-me/prisma';

export class UpdateLeadDto {
  @IsString()
  @IsOptional()
  pipelineId?: string;

  @IsString()
  @IsOptional()
  stageId?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[\d\s\+\-\(\)]+$/, {
    message: 'Phone number contains invalid characters',
  })
  phone?: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @Type(() => Number)
  @IsDecimal()
  @IsOptional()
  budget?: number;

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

  @IsEnum(LeadStatus)
  @IsOptional()
  status?: LeadStatus;
}
