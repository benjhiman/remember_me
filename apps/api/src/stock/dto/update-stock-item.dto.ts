import { IsString, IsOptional, IsDecimal, IsEnum, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ItemCondition, StockStatus } from '@remember-me/prisma';

export class UpdateStockItemDto {
  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  storage?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsEnum(ItemCondition)
  @IsOptional()
  condition?: ItemCondition;

  @IsString()
  @IsOptional()
  imei?: string;

  @IsString()
  @IsOptional()
  serialNumber?: string;

  @Type(() => Number)
  @IsDecimal()
  @IsOptional()
  costPrice?: number;

  @Type(() => Number)
  @IsDecimal()
  @IsOptional()
  basePrice?: number;

  @IsEnum(StockStatus)
  @IsOptional()
  status?: StockStatus;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
