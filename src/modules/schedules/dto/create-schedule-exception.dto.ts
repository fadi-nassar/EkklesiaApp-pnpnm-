import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateScheduleExceptionDto {
  @IsDateString()
  date: string;

  @IsIn(['cancel', 'override', 'special'])
  action: string;

  @IsOptional()
  @IsString()
  time?: string;

  @IsOptional()
  @IsIn(['mass', 'regular_prayer'])
  serviceType?: string;
}
