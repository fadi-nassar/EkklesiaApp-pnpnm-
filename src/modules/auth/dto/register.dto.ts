import {
  IsEmail,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsString,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsMongoId()
  homeInstitutionId: string;

  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['orthodox'])
  rite: string;
}
