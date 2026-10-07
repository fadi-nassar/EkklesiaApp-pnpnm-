import {
  IsDateString,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateFuneralBookingDto {
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
  @MaxLength(1000)
  notes?: string;
}
