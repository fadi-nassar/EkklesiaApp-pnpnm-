import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class CreateInstitutionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsIn(['church', 'monastery'])
  type: string;

  @IsString()
  @IsNotEmpty()
  town: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['orthodox'])
  rite: string;
}
