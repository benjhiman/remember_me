import { IsArray, ValidateNested, IsString, IsNumber, IsOptional, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

class BulkUpdateItemDto {
  @IsString()
  priceListItemId!: string;

  @ValidateIf((o) => o.basePrice !== null && o.basePrice !== undefined)
  @IsNumber()
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
