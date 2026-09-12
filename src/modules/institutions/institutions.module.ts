import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Institution,
  InstitutionSchema,
} from './schemas/institution.schema.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Institution.name, schema: InstitutionSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class InstitutionsModule {}
