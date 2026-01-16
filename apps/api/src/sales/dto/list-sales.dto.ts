import { IsOptional, IsString, IsInt, Min, IsEnum, IsDateString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { SaleStatus } from '@remember-me/prisma';

export class ListSalesDto {
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
  q?: string; // Search by customerName/email/phone

  @IsEnum(SaleStatus)
  @IsOptional()
  status?: SaleStatus;

  @IsString()
  @IsOptional()
  createdById?: string;

  @IsDateString()
  @IsOptional()
  createdFrom?: string;

  @IsDateString()
  @IsOptional()
  createdTo?: string;

  @IsString()
  @IsOptional()
  sort?: string; // createdAt, updatedAt (default: createdAt)

  @IsString()
  @IsOptional()
  order?: 'asc' | 'desc'; // default: desc

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  includeDeleted?: boolean; // Added for soft delete
}
