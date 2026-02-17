import { IsString, IsOptional, MinLength } from 'class-validator';

export class CreateFolderDto {
  @IsString()
  @MinLength(1)
  name!: string; // Folder name (e.g., "iPhone", "iPad", "Samsung")

  @IsString()
  @IsOptional()
  description?: string; // Optional description
}
