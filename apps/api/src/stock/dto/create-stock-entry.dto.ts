import { IsString, IsOptional, IsDecimal, IsEnum, IsObject, IsInt, Min, IsArray, ArrayMinSize, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { ItemCondition, StockStatus } from '@remember-me/prisma';

export enum StockEntryMode {
  IMEI = 'IMEI',
  QUANTITY = 'QUANTITY',
}

export class CreateStockEntryDto {
  @IsEnum(StockEntryMode)
  mode!: StockEntryMode;

  @IsString()
  itemId!: string;

  // For QUANTITY mode
  @ValidateIf((o) => o.mode === StockEntryMode.QUANTITY)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  // For IMEI mode
  @ValidateIf((o) => o.mode === StockEntryMode.IMEI)
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  imeis?: string[];

  @IsEnum(ItemCondition)
  @IsOptional()
  condition?: ItemCondition;

  @IsEnum(StockStatus)
  @IsOptional()
  status?: StockStatus;

  @Type(() => Number)
  @IsDecimal()
  @IsOptional()
  cost?: number;

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
