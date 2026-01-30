import { IsString, IsOptional, IsInt, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReservationDto {
  @IsString()
  @IsOptional()
  itemId?: string; // FK to Item (product catalog) - for quantity-based reservations

  @IsString()
  @IsOptional()
  stockItemId?: string; // FK to StockItem - for legacy/specific item reservations

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @IsDateString()
  @IsOptional()
  expiresAt?: string; // ISO date string

  @IsString()
  @IsOptional()
  saleId?: string; // Link opcional con Sale

  @IsString()
  @IsOptional()
  customerName?: string; // Customer name for the reservation

  @IsString()
  @IsOptional()
  notes?: string;
}
