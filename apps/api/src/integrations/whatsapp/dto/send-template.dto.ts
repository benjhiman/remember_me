import { IsString, IsObject, IsOptional } from 'class-validator';

export class SendTemplateDto {
  @IsString()
  toPhone!: string;

  @IsString()
  templateId!: string;

  @IsObject()
  variables!: Record<string, string>; // Template variable values

  @IsString()
  @IsOptional()
  leadId?: string;
}
