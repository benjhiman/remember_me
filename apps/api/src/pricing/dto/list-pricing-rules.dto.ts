import { IsOptional, IsString, IsInt, Min, IsBoolean, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ScopeType } from '@remember-me/prisma';

export class ListPricingRulesDto {
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
  q?: string; // Search by name

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsEnum(ScopeType)
  @IsOptional()
  scopeType?: ScopeType;

  @IsString()
  @IsOptional()
  sort?: string; // priority, createdAt (default: priority desc)

  @IsString()
  @IsOptional()
  order?: 'asc' | 'desc'; // default: desc

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  includeDeleted?: boolean; // Added for soft delete
}
