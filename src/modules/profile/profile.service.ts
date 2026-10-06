import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schema/user.schema.js';
import {
  Institution,
  InstitutionDocument,
} from '../institutions/schemas/institution.schema.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

// explicit field list: passwordHash is never selected
const PROFILE_FIELDS =
  'username email role rite homeInstitutionId managedInstitutionIds';

@Injectable()
export class ProfileService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Institution.name)
    private readonly institutionModel: Model<InstitutionDocument>,
  ) {}

  async getMe(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select(PROFILE_FIELDS)
      .exec();
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return this.toProfile(user);
  }

  async updateMe(userId: string, dto: UpdateProfileDto) {
    if (dto.homeInstitutionId) {
      const institutionExists = await this.institutionModel.exists({
        _id: dto.homeInstitutionId,
      });
      if (!institutionExists) {
        throw new NotFoundException(
          `Institution with ID ${dto.homeInstitutionId} not found.`,
        );
      }
    }

    const update: Partial<UpdateProfileDto> = {};
    if (dto.username !== undefined) {
      update.username = dto.username;
    }
    if (dto.homeInstitutionId !== undefined) {
      update.homeInstitutionId = dto.homeInstitutionId;
    }
    if (Object.keys(update).length === 0) {
      return this.getMe(userId);
    }

    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: update }, { new: true })
      .select(PROFILE_FIELDS)
      .exec();
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    return this.toProfile(user);
  }

  private toProfile(user: UserDocument) {
    return {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
      rite: user.rite,
      homeInstitutionId: user.homeInstitutionId,
      managedInstitutionIds: user.managedInstitutionIds,
    };
  }
}
