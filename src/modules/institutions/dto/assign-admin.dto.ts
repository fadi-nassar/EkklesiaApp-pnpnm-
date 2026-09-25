import { IsNotEmpty, IsString } from 'class-validator';

export class AssignAdminDto {
  @IsNotEmpty()
  @IsString()
  userId: string;
}
