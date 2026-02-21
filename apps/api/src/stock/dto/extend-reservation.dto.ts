import { IsInt, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class ExtendReservationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  hours?: number = 24; // Default 24 hours
}
