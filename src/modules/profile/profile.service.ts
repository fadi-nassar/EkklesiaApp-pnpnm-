import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Document, Model, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, UserDocument } from '../users/schema/user.schema.js';
import {
  Institution,
  InstitutionDocument,
} from '../institutions/schemas/institution.schema.js';
import { Follow, FollowDocument } from '../follows/schema/follow.schema.js';
import { Booking, BookingDocument } from '../bookings/schema/booking.schema.js';
import {
  Notification,
  NotificationDocument,
} from '../notifications/schema/notification.schema.js';
import { Session } from '../auth/schema/session.schema.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

type SessionDocument = Session & Document;

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
    @InjectModel(Follow.name)
    private readonly followModel: Model<FollowDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
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


  async deleteAccount(userId: string, password: string): Promise<void> {
    const userObjectId = new Types.ObjectId(userId);

    const session = await this.userModel.db.startSession();
    session.startTransaction();
    try {
      const user = await this.userModel.findById(userObjectId).select('+passwordHash').session(session);
      if (!user) {
        throw new NotFoundException('User not found.');
      }

      if (!(await bcrypt.compare(password, user.passwordHash))) {
        throw new UnauthorizedException('Incorrect password.');
      }

      if (user.role === 'superAdmin') {
        throw new ForbiddenException(
          'A superAdmin cannot delete their own account.',
        );
      }

      const soleAdminInstitutions = await this.institutionModel
        .find({ admins: userObjectId, 'admins.1': { $exists: false } })
        .session(session);
      if (soleAdminInstitutions.length) {
        throw new ConflictException(
          'Cannot delete account while sole admin of an institution. Assign another admin first.',
        );
      }

      const userFollows = await this.followModel
        .find({ userId: userObjectId })
        .session(session);
      for (const follow of userFollows) {
        await this.institutionModel.updateOne(
          { _id: follow.institutionId },
          { $inc: { followerCount: -1 } },
          { session },
        );
      }
      await this.followModel.deleteMany({ userId: userObjectId }, { session });

      await this.bookingModel.deleteMany(
        { userId: userObjectId, startsAt: { $gt: new Date() } },
        { session },
      );

      await this.notificationModel.deleteMany(
        { userId: userObjectId },
        { session },
      );

      await this.sessionModel.deleteMany({ userId: userObjectId }, { session });

      await this.institutionModel.updateMany(
        { admins: userObjectId },
        { $pull: { admins: userObjectId } },
        { session },
      );

      await this.userModel.deleteOne({ _id: userObjectId }, { session });

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
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
