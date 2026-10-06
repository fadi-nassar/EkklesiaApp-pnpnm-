import { Transform } from 'class-transformer';
import { IsInt, IsString, Length, Min } from 'class-validator';

export class CreateSalonDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 50)
  name: string;

  @IsInt()
  @Min(1)
  maxAttendance: number;
}
