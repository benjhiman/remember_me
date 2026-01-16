import { IsString, IsOptional, IsDecimal, IsEmail, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSaleDto {
  @IsString()
  @IsOptional()
  customerName?: string;

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
  notes?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}
