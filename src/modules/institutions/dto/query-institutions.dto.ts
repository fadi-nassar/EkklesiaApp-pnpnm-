import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class QueryInstitutionsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsIn(['church', 'monastery'])
  type?: string;

  @IsOptional()
  @IsIn(['orthodox'])
  rite?: string;
}
