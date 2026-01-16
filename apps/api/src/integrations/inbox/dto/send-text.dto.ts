import { IsString, IsOptional, IsEnum, ValidateIf } from 'class-validator';

export enum MediaType {
  IMAGE = 'image',
  DOCUMENT = 'document',
}

export class SendTextDto {
  @IsString()
  @IsOptional()
  @ValidateIf((o) => !o.mediaUrl)
  text?: string;

  @IsString()
  @IsOptional()
  mediaUrl?: string;

  @IsEnum(MediaType)
  @IsOptional()
  @ValidateIf((o) => !!o.mediaUrl)
  mediaType?: MediaType;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => !!o.mediaUrl)
  caption?: string;
}
