import { IsOptional, IsString, IsInt, Min, IsEnum, IsDateString, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { LeadStatus } from '@remember-me/prisma';

export class ListLeadsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsString()
  @IsOptional()
  q?: string; // Alias for search

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  pipelineId?: string;

  @IsString()
  @IsOptional()
  stageId?: string;

  @IsString()
  @IsOptional()
  assignedToId?: string;

  @IsEnum(LeadStatus)
  @IsOptional()
  status?: LeadStatus;

  @IsDateString()
  @IsOptional()
  createdFrom?: string;

  @IsDateString()
  @IsOptional()
  createdTo?: string;

  @IsString()
  @IsOptional()
  @Matches(/^(createdAt|updatedAt)(Desc|Asc)?$/i, {
    message: 'sort must be "createdAt", "updatedAt", "createdAtDesc", "updatedAtDesc", "createdAtAsc", or "updatedAtAsc"',
  })
  sort?: string;

  @IsOptional()
  @Type(() => Boolean)
  includeDeleted?: boolean;
}
