import { IsString, IsEnum, IsObject, IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { WhatsAppAutomationTrigger, WhatsAppAutomationAction } from '@remember-me/prisma';

export class UpdateAutomationRuleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(WhatsAppAutomationTrigger)
  @IsOptional()
  trigger?: WhatsAppAutomationTrigger;

  @IsEnum(WhatsAppAutomationAction)
  @IsOptional()
  action?: WhatsAppAutomationAction;

  @IsObject()
  @IsOptional()
  payloadJson?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  cooldownHours?: number;
}
