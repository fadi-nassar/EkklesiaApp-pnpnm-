import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

export class UpdateSalonDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 50)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxAttendance?: number;
}
