import { IsString, IsOptional, IsEnum, IsInt, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { StockMovementType } from '@remember-me/prisma';

export class StockMovementsDto {
  @IsString()
  @IsOptional()
  itemId?: string;

  @IsEnum(StockMovementType)
  @IsOptional()
  type?: StockMovementType;

  @IsDateString()
  @IsOptional()
  from?: string;

  @IsDateString()
  @IsOptional()
  to?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 50;
}
