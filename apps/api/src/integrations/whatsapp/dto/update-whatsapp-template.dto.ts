import { IsString, IsEnum, IsObject, IsOptional } from 'class-validator';
import { WhatsAppTemplateCategory, WhatsAppTemplateStatus } from '@remember-me/prisma';

export class UpdateWhatsAppTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsEnum(WhatsAppTemplateCategory)
  @IsOptional()
  category?: WhatsAppTemplateCategory;

  @IsObject()
  @IsOptional()
  componentsJson?: Record<string, any>;

  @IsEnum(WhatsAppTemplateStatus)
  @IsOptional()
  status?: WhatsAppTemplateStatus;
}
