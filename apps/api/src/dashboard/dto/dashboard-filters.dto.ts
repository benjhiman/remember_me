import { IsOptional, IsDateString, IsEnum, IsBoolean, IsInt, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum GroupByPeriod {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
}

export class DashboardFiltersDto {
  @IsDateString()
  @IsOptional()
  from?: string; // ISO date string

  @IsDateString()
  @IsOptional()
  to?: string; // ISO date string

  @IsString()
  @IsOptional()
  tz?: string; // Timezone (optional)

  @IsEnum(GroupByPeriod)
  @IsOptional()
  groupBy?: GroupByPeriod = GroupByPeriod.DAY;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  compare?: boolean = false; // Compare with previous period

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  threshold?: number = 5; // For low stock (stock endpoint only)
}
