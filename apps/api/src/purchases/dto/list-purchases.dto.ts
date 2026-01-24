import { IsOptional, IsString, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { PurchaseStatus } from '@remember-me/prisma';

export class ListPurchasesDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;

  @IsString()
  @IsOptional()
  q?: string; // Search by purchase number or vendor name

  @IsEnum(PurchaseStatus)
  @IsOptional()
  status?: PurchaseStatus;

  @IsString()
  @IsOptional()
  vendorId?: string;
}
