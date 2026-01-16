import { IsString, IsOptional, IsDecimal, IsEnum, IsObject, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ItemCondition, StockStatus } from '@remember-me/prisma';

export class CreateStockItemDto {
  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  model!: string;

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
  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number = 1;

  @Type(() => Number)
  @IsDecimal()
  costPrice!: number;

  @Type(() => Number)
  @IsDecimal()
  basePrice!: number;

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
