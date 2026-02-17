import { IsString, IsEnum, IsArray, IsOptional, MinLength } from 'class-validator';

export class CreatePriceListDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(['ALL', 'FOLDERS', 'ITEMS'])
  mode!: 'ALL' | 'FOLDERS' | 'ITEMS';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  folderIds?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  itemIds?: string[];
}
