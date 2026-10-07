import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class NearbyInstitutionsDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  maxDistance?: number;

  @IsOptional()
  @IsIn(['orthodox'])
  rite?: string;

  // only the exact string "true" counts as true; anything else (including
  // "false" or garbage) is treated as false by the controller, matching the
  // documented behaviour — so this stays a plain string, not a boolean
  @IsOptional()
  @IsString()
  includeAllCountries?: string;
}
