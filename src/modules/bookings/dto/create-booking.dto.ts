import {
  IsDateString,
  IsIn,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateBookingDto {
  @IsString()
  @IsIn(['wedding', 'baptism', 'engagement'])
  bookingType: string;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  endsAt: string;

  @IsInt()
  @Min(1)
  headcount: number;

  @IsOptional()
  @IsMongoId()
  salonId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
