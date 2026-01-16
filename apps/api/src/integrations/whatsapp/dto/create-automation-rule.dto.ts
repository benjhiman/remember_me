import { IsString, IsEnum, IsObject, IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { WhatsAppAutomationTrigger, WhatsAppAutomationAction } from '@remember-me/prisma';

export class CreateAutomationRuleDto {
  @IsString()
  name!: string;

  @IsEnum(WhatsAppAutomationTrigger)
  trigger!: WhatsAppAutomationTrigger;

  @IsEnum(WhatsAppAutomationAction)
  action!: WhatsAppAutomationAction;

  @IsObject()
  payloadJson!: Record<string, any>; // templateId/text + variables mapping

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsInt()
  @Min(0)
  @IsOptional()
  cooldownHours?: number;
}
