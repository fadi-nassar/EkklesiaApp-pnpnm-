import { IsMongoId } from 'class-validator';

export class AssignAdminDto {
  @IsMongoId()
  userId: string;
}
