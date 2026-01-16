import { IsString, IsOptional, IsDecimal, IsEnum, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ItemCondition } from '@remember-me/prisma';

export class CalculatePriceDto {
  @Type(() => Number)
  @IsDecimal()
  basePrice!: number;

  @IsString()
  model!: string;

  @IsEnum(ItemCondition)
  @IsOptional()
  condition?: ItemCondition;

  @IsString()
  @IsOptional()
  storage?: string;

  @IsString()
  @IsOptional()
  color?: string;

  // Información del cliente (para reglas basadas en customerType, country, etc.)
  @IsObject()
  @IsOptional()
  customerContext?: Record<string, any>; // { "customerType": "vip", "country": "AR" }
}
