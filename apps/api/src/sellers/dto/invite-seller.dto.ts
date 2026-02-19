import { IsEmail, IsString } from 'class-validator';

export class InviteSellerDto {
  @IsEmail()
  email!: string;
}
