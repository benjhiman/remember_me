import { IsEnum } from 'class-validator';
import { PurchaseStatus } from '@remember-me/prisma';

export class TransitionPurchaseDto {
  @IsEnum(PurchaseStatus)
  status!: PurchaseStatus;
}
