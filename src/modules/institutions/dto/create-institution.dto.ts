import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateInstitutionDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
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

  @IsNumber()
  @IsInt()
  @Min(1)
  maxAttendance: number;

  @IsOptional()
  @IsNumber()
  @IsInt()
  @Min(0)
  bufferMinutes?: number;
}
