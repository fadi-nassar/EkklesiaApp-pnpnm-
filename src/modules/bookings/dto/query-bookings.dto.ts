import { IsDateString, IsIn, IsOptional } from 'class-validator';

export class QueryBookingsDto {
  @IsOptional()
  @IsIn(['requested', 'approved', 'rejected', 'cancelled'])
  status?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
