import {
  IsDateString,
  IsIn,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';

export class CreateScheduleExceptionDto {
  @IsDateString()
  date: string;

  @IsIn(['cancel', 'override', 'special'])
  action: string;

  // required for override and special; optional for cancel, but still
  // format-checked if it is sent
  @ValidateIf(
    (o) =>
      o.action === 'override' || o.action === 'special' || o.time !== undefined,
  )
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'time must be HH:mm in 24-hour format',
  })
  time?: string;

  // required for special; optional otherwise, but still checked if it is sent
  @ValidateIf((o) => o.action === 'special' || o.serviceType !== undefined)
  @IsIn(['mass', 'regular_prayer'])
  serviceType?: string;
}
