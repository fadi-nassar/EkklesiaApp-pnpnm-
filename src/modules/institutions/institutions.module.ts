import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Institution,
  InstitutionSchema,
} from './schemas/institution.schema.js';
import { AdminGuard } from '../../common/guards/admin-guard.js';
import { SuperAdminGuard } from '../../common/guards/super-admin-guard.js';
import { InstitutionsService } from './institutions.service.js';
import { InstitutionsController } from './institution.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Institution.name, schema: InstitutionSchema },
    ]),
    AuthModule,
    UsersModule,
  ],
  exports: [MongooseModule],
  providers: [AdminGuard, SuperAdminGuard, InstitutionsService],
  controllers: [InstitutionsController],
})
export class InstitutionsModule {}
