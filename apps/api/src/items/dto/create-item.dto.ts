import { IsString, IsOptional, IsObject, IsBoolean, IsInt, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ItemCondition } from '@remember-me/prisma';

export class CreateItemDto {
  @IsString()
  @IsOptional()
  name?: string; // Optional: will be auto-generated if not provided

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  brand!: string; // Required, default "Apple" in service if not provided

  @IsString()
  model!: string; // Required: e.g., "iPhone 15 Pro"

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10240)
  storageGb!: number; // Required: e.g., 64, 128, 256, 512, 1024

  @IsEnum(ItemCondition)
  condition!: ItemCondition; // Required: NEW, USED, REFURBISHED, OEM

  @IsString()
  color!: string; // Required: e.g., "Natural Titanium", "Blue"

  @IsString()
  @IsOptional()
  description?: string;

  @IsObject()
  @IsOptional()
  attributes?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @IsString()
  @IsOptional()
  seedSource?: string;

  @IsInt()
  @IsOptional()
  seedVersion?: number;

  @IsString()
  @IsOptional()
  folderId?: string; // Folder ID - required when creating from root, optional when inside folder
}
