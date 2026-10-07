import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Follow, FollowDocument } from './schema/follow.schema.js';
import {
  Institution,
  InstitutionDocument,
} from '../institutions/schemas/institution.schema.js';

@Injectable()
export class FollowsService {
  constructor(
    @InjectModel(Follow.name)
    private readonly followModel: Model<FollowDocument>,
    @InjectModel(Institution.name)
    private readonly institutionModel: Model<InstitutionDocument>,
  ) {}

  async follow(userId: string, institutionId: string): Promise<Follow> {
    const institution = await this.institutionModel.findById(institutionId);
    if (!institution) {
      throw new NotFoundException(
        `Institution with ID ${institutionId} not found.`,
      );
    }

    const created = new this.followModel({ userId, institutionId });

    try {
      await created.save();
    } catch (error: any) {
      if (error.code === 11000) {
        throw new ConflictException('Already following this institution');
      }
      throw error;
    }

    await this.institutionModel.findByIdAndUpdate(institutionId, {
      $inc: { followerCount: 1 },
    });

    return created;
  }

  async unfollow(userId: string, institutionId: string): Promise<void> {
    const result = await this.followModel.deleteOne({
      userId,
      institutionId,
    });
    if (result.deletedCount === 0) {
      throw new NotFoundException('Not following this institution');
    }

    await this.institutionModel.findByIdAndUpdate(institutionId, {
      $inc: { followerCount: -1 },
    });
  }

  async getFollowerIds(institutionId: string): Promise<string[]> {
    const follows = await this.followModel.find({ institutionId }).select('userId').exec();
    return follows.map((follow) => follow.userId.toString());
  }

  async getFollowedInstitutions(userId: string): Promise<Institution[]> {
    const follows = await this.followModel
      .find({ userId })
      .populate('institutionId', '-admins')
      .exec();

    return follows.map(
      (follow) => follow.institutionId as unknown as Institution,
    );
  }
}
