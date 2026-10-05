import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const MONGO_ID_REGEX = /^[0-9a-fA-F]{24}$/;

@Injectable()
export class ParseMongoIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !MONGO_ID_REGEX.test(value)) {
      throw new BadRequestException('Invalid id');
    }
    return value;
  }
}
