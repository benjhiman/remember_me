import { IsString, IsOptional, IsObject, IsBoolean } from 'class-validator';

export class CreateItemDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  brand?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  attributes?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
