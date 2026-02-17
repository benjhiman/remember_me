import { IsNumber, IsOptional, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePriceListItemDto {
  @ValidateIf((o) => o.basePrice !== null)
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  basePrice?: number | null;
}
