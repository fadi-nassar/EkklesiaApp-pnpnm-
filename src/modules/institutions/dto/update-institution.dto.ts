import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

// the only fields an admin can change; everything else is rejected
export class UpdateInstitutionDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9 ()-]{6,20}$/, {
    message: 'phone must be 6 to 20 digits, spaces, brackets or dashes, with an optional leading +',
  })
  phone?: string;

  @IsOptional()
  @IsUrl()
  instagramUrl?: string;

  @IsOptional()
  @IsUrl()
  facebookUrl?: string;

  @IsOptional()
  @IsUrl()
  mapsUrl?: string;

  @IsOptional()
  @IsUrl()
  coverImage?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttendance?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferMinutes?: number;
}
