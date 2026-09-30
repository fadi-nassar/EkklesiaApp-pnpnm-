import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateInstitutionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsIn(['church', 'monastery'])
  type: string;

  @IsOptional()
  @IsString()
  town?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['orthodox'])
  rite: string;
}
