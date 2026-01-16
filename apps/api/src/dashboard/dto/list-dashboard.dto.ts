import { IsOptional, IsString } from 'class-validator';

export class ListDashboardDto {
  @IsString()
  @IsOptional()
  period?: string;
}
