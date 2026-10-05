import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateScheduleExceptionDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsIn(['cancel', 'override', 'special'])
  action?: string;

  @IsOptional()
  @IsString()
  time?: string;

  @IsOptional()
  @IsIn(['mass', 'regular_prayer'])
  serviceType?: string;
}
