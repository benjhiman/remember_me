import { IsString, IsOptional, IsDecimal, IsArray, ValidateNested, IsObject, IsEmail, MinLength, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSaleItemDto } from './create-sale-item.dto';

export class CreateSaleDto {
  @IsString()
  @IsOptional()
  leadId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  stockReservationIds?: string[]; // IDs de reservas de stock para linkear (opcional)

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  @IsOptional()
  items?: CreateSaleItemDto[]; // Items directos sin reservas (opcional)

  @IsString()
  @MinLength(1)
  customerName!: string;

  @IsString()
  @IsEmail()
  @IsOptional()
  customerEmail?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @Type(() => Number)
  @IsDecimal()
  @IsOptional()
  discount?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  subject?: string; // Subject/description for invoice

  @IsString()
  @IsOptional()
  location?: string; // Warehouse/Location

  @IsString()
  @IsOptional()
  orderNumber?: string; // Order number

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
