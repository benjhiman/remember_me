import { IsString, IsNotEmpty, Matches, MaxLength } from 'class-validator';

export class CreateFolderPrefixDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z0-9]{2,10}$/i, {
    message: 'Prefix must be 2-10 alphanumeric characters',
  })
  @MaxLength(10)
  prefix!: string;
}
