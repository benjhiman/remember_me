import { IsString, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCommissionDto {
  @IsString()
  mode!: string; // PER_UNIT, PERCENT_GROSS_PROFIT, PER_MODEL, PERCENT_SALE

  @Type(() => Number)
  @IsNumber()
  value!: number; // Valor según el modo
}
