import { IsIn, IsInt, IsString, Matches, Max, Min } from 'class-validator';

export class CreateScheduleDto {
  // 0 = Sunday, matching Date#getDay()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'time must be HH:mm in 24-hour format',
  })
  time: string;

  @IsIn(['mass', 'regular_prayer'])
  serviceType: string;
}
