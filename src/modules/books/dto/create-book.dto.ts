import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateBookDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsString()
  prayerType?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  language?: string;

  @IsUrl()
  fileUrl: string;

  @IsOptional()
  @IsUrl()
  coverUrl?: string;
}
