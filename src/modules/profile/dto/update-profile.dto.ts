import { IsMongoId, IsOptional, IsString, Length } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 50)
  username?: string;

  @IsOptional()
  @IsMongoId()
  homeInstitutionId?: string;
}
