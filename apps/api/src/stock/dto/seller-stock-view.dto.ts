import { IsOptional, IsString } from 'class-validator';

export class SellerStockViewDto {
  @IsOptional()
  @IsString()
  search?: string;
}
