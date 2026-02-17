import { IsArray, ValidateNested, IsString, IsDecimal, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class BulkUpdateItemDto {
  @IsString()
  priceListItemId!: string;

  @IsDecimal()
  @IsOptional()
  @Type(() => Number)
  basePrice?: number | null;
}

export class BulkUpdatePriceListItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateItemDto)
  items!: BulkUpdateItemDto[];
}
