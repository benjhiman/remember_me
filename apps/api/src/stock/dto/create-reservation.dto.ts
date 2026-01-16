import { IsString, IsOptional, IsInt, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReservationDto {
  @IsString()
  stockItemId!: string;

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
  notes?: string;
}
