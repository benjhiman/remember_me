import { IsOptional, IsString, IsInt, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class ListCustomersDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number;

  @IsString()
  @IsOptional()
  q?: string; // Search by name, email, or phone

  @IsString()
  @IsOptional()
  status?: string; // ACTIVE, INACTIVE

  @IsString()
  @IsOptional()
  sellerId?: string; // Filter by assigned seller (admin only)

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  mine?: boolean; // true -> assignedToUserId = currentUserId
}
