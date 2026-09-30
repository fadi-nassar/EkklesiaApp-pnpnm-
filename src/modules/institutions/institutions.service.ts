import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Institution,
  InstitutionDocument,
} from './schemas/institution.schema.js';
import { CreateInstitutionDto } from './dto/create-institution.dto.js';
import { User, UserDocument } from '../users/schema/user.schema.js';
import { geocodeAddress } from './geocoding.util.js';

const TOWN_COORDINATES: Record<string, { lng: number; lat: number }> = {
  Kousba: { lng: 35.8528, lat: 34.3017 },
};

@Injectable()
export class InstitutionsService {
  constructor(
    @InjectModel(Institution.name)
    private readonly institutionModel: Model<InstitutionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  //for super admin only
  async createInstitution(
    createInstitutionDto: CreateInstitutionDto,
  ): Promise<Institution> {
    let coordinates: { lat: number; lng: number } | null = null;
    if (createInstitutionDto.address){
      coordinates = await geocodeAddress(createInstitutionDto.address);
    }
    if (!coordinates && createInstitutionDto.town){
      coordinates = TOWN_COORDINATES[createInstitutionDto.town] ?? null
    }
    if (!coordinates) {
      throw new BadRequestException("Could not resolve a location from the provided address or town."); }
    const createdInstitution = new this.institutionModel({
      name: createInstitutionDto.name,
      type: createInstitutionDto.type,
      currency: 'USD', // Default currency, you can modify this as needed
      timezone: 'Asia/Beirut', // Default timezone, you can modify this as needed
      rite: createInstitutionDto.rite,
      admins: [], // Default empty admins array, you can modify this as needed
      location: { type: 'Point', coordinates: [coordinates.lng, coordinates.lat] }, // Set the coordinates based on the town
    });
    await createdInstitution.save();
    return this.institutionModel
      .findById(createdInstitution._id)
      .select('-admins')
      .exec() as Promise<Institution>;

      

  }
  async assignAdminToInstitution(
    institutionId: string,
    adminId: string,
  ): Promise<Institution> {
    const session = await this.institutionModel.db.startSession();
    session.startTransaction();
    try {
      const institution = await this.institutionModel
        .findById(institutionId)
        .session(session);
      if (!institution) {
        throw new NotFoundException(
          `Institution with ID ${institutionId} not found.`,
        );
      }
      const admin = await this.userModel.findById(adminId).session(session);
      if (!admin) {
        throw new NotFoundException(`User with ID ${adminId} not found.`);
      }
      if (admin.role === 'superAdmin') {
        throw new BadRequestException(
          `User with ID ${adminId} is a superAdmin and cannot be assigned as a churchAdmin.`,
        );
      }

      const adminObjectId = new Types.ObjectId(adminId);
      if (
        institution.admins.some((existingAdminId) =>
          existingAdminId.equals(adminObjectId),
        )
      ) {
        throw new BadRequestException(
          `User with ID ${adminId} is already an admin of this institution.`,
        );
      }
      if (institution.admins.length >= 5) {
        throw new BadRequestException(
          `Institution with ID ${institutionId} already has the maximum of 5 admins.`,
        );
      }

      institution.admins.push(adminObjectId);

      admin.role = 'churchAdmin';
      if (
        !admin.managedInstitutionIds.some((id) =>
          id.equals(institution._id as Types.ObjectId),
        )
      ) {
        admin.managedInstitutionIds.push(institution._id as Types.ObjectId);
      }
      await admin.save({ session });
      const savedInstitution = await institution.save({ session });

      await session.commitTransaction();
      return savedInstitution;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  //for anyone
  async getInstitutionById(id: string): Promise<Institution> {
    const institution = await this.institutionModel
      .findById(id)
      .select('-admins')
      .exec();
    if (!institution) {
      throw new NotFoundException(`Institution with ID ${id} not found.`);
    }
    return institution;
  }
  async getAllInstitutionsByNameTypeRite(query: {
    name?: string;
    type?: string;
    rite?: string;
  }): Promise<Institution[]> {
    const filter: any = {};
    if (query.name) {
      filter.name = { $regex: query.name, $options: 'i' };
    }
    if (query.type) {
      filter.type = query.type;
    }
    if (query.rite) {
      filter.rite = query.rite;
    }

    return this.institutionModel.find(filter).select('-admins').exec();
  }

  async deleteInstitution(id: string): Promise<void> {
    const result = await this.institutionModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Institution with ID ${id} not found.`);
    }
  }
}
