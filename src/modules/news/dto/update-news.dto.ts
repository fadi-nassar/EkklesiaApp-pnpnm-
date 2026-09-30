import { IsDateString, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateNewsDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  @IsOptional()
  @IsUrl()
  image?: string;

  @IsOptional()
  @IsDateString()
  publishedAt?: string;
}
