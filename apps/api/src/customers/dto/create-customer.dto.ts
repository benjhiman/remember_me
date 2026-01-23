import { IsString, IsOptional, IsEmail, Matches } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  name!: string;

  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @Matches(/^[\d\s\+\-\(\)]+$/, {
    message: 'Phone number contains invalid characters',
  })
  phone?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  status?: string; // ACTIVE, INACTIVE
}
