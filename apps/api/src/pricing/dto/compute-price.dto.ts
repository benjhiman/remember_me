import { IsString, IsOptional, IsDecimal, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class ComputePriceDto {
  @IsString()
  stockItemId!: string;

  @Type(() => Number)
  @IsDecimal()
  @IsOptional()
  baseCost?: number; // Override basePrice from StockItem

  @IsObject()
  @IsOptional()
  context?: Record<string, any>; // Customer context, etc.
}
