import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class NearbyInstitutionsDto {
  @Type(() => Number)
  @IsNumber()
  lat: number;

  @Type(() => Number)
  @IsNumber()
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
