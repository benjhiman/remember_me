import { IsString, IsOptional, IsDecimal, IsArray, ValidateNested, IsObject, IsEmail, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSaleItemDto } from './create-sale-item.dto';

export class CreateSaleDto {
  @IsString()
  @IsOptional()
  leadId?: string;

  @IsArray()
  @IsString({ each: true })
  stockReservationIds!: string[]; // IDs de reservas de stock para linkear

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

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
