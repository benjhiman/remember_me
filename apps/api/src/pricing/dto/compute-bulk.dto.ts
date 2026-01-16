import { IsArray, ValidateNested, IsOptional, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ComputePriceDto } from './compute-price.dto';

export class ComputeBulkDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComputePriceDto)
  items!: ComputePriceDto[];

  @IsObject()
  @IsOptional()
  context?: Record<string, any>; // Shared context for all items
}
