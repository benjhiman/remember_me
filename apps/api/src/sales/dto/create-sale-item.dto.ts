import { IsString, IsOptional, IsInt, IsDecimal, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSaleItemDto {
  @IsString()
  @IsOptional()
  stockItemId?: string; // Si viene de stock, reservar el item

  @IsString()
  model!: string; // Snapshot del modelo

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @Type(() => Number)
  @IsDecimal()
  unitPrice!: number;
}
