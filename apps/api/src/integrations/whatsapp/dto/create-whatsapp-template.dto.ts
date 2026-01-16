import { IsString, IsEnum, IsObject, IsOptional } from 'class-validator';
import { WhatsAppTemplateCategory } from '@remember-me/prisma';

export class CreateWhatsAppTemplateDto {
  @IsString()
  name!: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsEnum(WhatsAppTemplateCategory)
  category!: WhatsAppTemplateCategory;

  @IsObject()
  componentsJson!: Record<string, any>; // body/header/buttons with placeholders
}
