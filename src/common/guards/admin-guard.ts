import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Institution, InstitutionDocument } from '../../modules/institutions/schemas/institution.schema.js';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @InjectModel(Institution.name) private institutionModel: Model<InstitutionDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    if (request.user && request.user.role === 'superAdmin') {
      return true;
    }
    else if (request.user && request.user.role === 'churchAdmin') {
      
      const institutionIdFromRequest = request.body.institutionId || request.params.institutionId;

        if (!institutionIdFromRequest) {
            throw new ForbiddenException('Institution ID is required for churchAdmin users.');
        }

        const institution = await this.institutionModel.findById(institutionIdFromRequest).exec();
        if (!institution) {
            throw new ForbiddenException('Institution not found.');
        }
        if (institution.admins.some(adminId => adminId.toString() === request.user.userId)) {
            return true;
        }

    }

    return false; // placeholder
  }
}