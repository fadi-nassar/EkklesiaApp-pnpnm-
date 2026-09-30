import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Follow, FollowSchema } from './schema/follow.schema.js';
import {
  Institution,
  InstitutionSchema,
} from '../institutions/schemas/institution.schema.js';
import { FollowsService } from './follows.service.js';
import { FollowsController } from './follows.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Follow.name, schema: FollowSchema },
      { name: Institution.name, schema: InstitutionSchema },
    ]),
    AuthModule,
  ],
  exports: [MongooseModule, FollowsService],
  providers: [FollowsService],
  controllers: [FollowsController],
})
export class FollowsModule {}
