import { IsString, IsOptional, IsEnum, IsInt, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ItemCondition } from '@remember-me/prisma';

export class StockSummaryDto {
  @IsString()
  @IsOptional()
  q?: string;

  @IsString()
  @IsOptional()
  itemId?: string;

  @IsEnum(ItemCondition)
  @IsOptional()
  condition?: ItemCondition;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  includeZero?: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
