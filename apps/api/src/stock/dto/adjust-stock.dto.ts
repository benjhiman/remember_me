import { IsInt, IsString, IsOptional, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class AdjustStockDto {
  @Type(() => Number)
  @IsInt()
  quantityChange!: number; // Puede ser positivo o negativo

  @IsString()
  reason!: string; // Motivo del ajuste (obligatorio)

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
