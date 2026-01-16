import { IsOptional, IsString, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { StockStatus, ItemCondition } from '@remember-me/prisma';

export class ListStockItemsDto {
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
  search?: string;

  @IsString()
  @IsOptional()
  model?: string;

  @IsEnum(StockStatus)
  @IsOptional()
  status?: StockStatus;

  @IsEnum(ItemCondition)
  @IsOptional()
  condition?: ItemCondition;

  @IsString()
  @IsOptional()
  location?: string;

  @IsOptional()
  @Type(() => Boolean)
  includeDeleted?: boolean;
}
