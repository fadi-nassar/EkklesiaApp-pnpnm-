import { IsMongoId } from 'class-validator';

export class LogoutDto {
  @IsMongoId()
  sessionId: string;
}
