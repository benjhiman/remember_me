import { IsArray, ArrayMinSize, ValidateNested, IsString, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum BulkStockAddSource {
  PURCHASE = 'purchase',
  MANUAL = 'manual',
}

class BulkStockAddItemDto {
  @IsString()
  itemId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class BulkStockAddDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkStockAddItemDto)
  items!: BulkStockAddItemDto[];

  @IsString()
  @IsOptional()
  note?: string;

  @IsEnum(BulkStockAddSource)
  @IsOptional()
  source?: BulkStockAddSource;
}
