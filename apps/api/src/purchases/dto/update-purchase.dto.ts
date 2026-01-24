import { IsString, IsOptional, IsArray, ValidateNested, IsInt, Min, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePurchaseLineDto {
  @IsString()
  @IsOptional()
  id?: string; // If present, update existing line; if not, create new

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsInt()
  @Min(0)
  unitPriceCents!: number;

  @IsString()
  @IsOptional()
  sku?: string;
}

export class UpdatePurchaseDto {
  @IsString()
  @IsOptional()
  vendorId?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePurchaseLineDto)
  @IsOptional()
  lines?: UpdatePurchaseLineDto[];
}
