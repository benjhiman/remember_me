import { IsString } from 'class-validator';

export class ComputeSaleDto {
  @IsString()
  saleId!: string;
}
