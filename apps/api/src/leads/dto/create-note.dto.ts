import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateNoteDto {
  @IsString()
  @IsOptional()
  leadId?: string;

  @IsString()
  content!: string;

  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;
}
