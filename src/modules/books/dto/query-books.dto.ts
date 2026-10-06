import { IsOptional, IsString } from 'class-validator';

export class QueryBooksDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  prayerType?: string;
}
