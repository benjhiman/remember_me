import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsIn } from 'class-validator';

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;

export class CreateLedgerAccountDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsIn(ACCOUNT_TYPES)
  type!: typeof ACCOUNT_TYPES[number];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}
