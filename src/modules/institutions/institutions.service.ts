import {
  BadRequestException,
  ConflictException,
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
import { isWithinLebanon } from './location.util.js';
import { escapeRegex } from '../../common/utils/escape-regex.js';
import { UpdateInstitutionDto } from './dto/update-institution.dto.js';
import { create } from 'domain';
import { Booking, BookingDocument } from '../bookings/schema/booking.schema.js';

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
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
  ) {}

  //for super admin only
  async createInstitution(
    createInstitutionDto: CreateInstitutionDto,
  ): Promise<Institution> {
    let coordinates: { lat: number; lng: number } | null = null;
    let country = '';
    if (createInstitutionDto.address){
      const geocoded = await geocodeAddress(createInstitutionDto.address);
      coordinates = geocoded;
      if (geocoded) country = geocoded.country;
    }
    if (!coordinates && createInstitutionDto.town){
      coordinates = TOWN_COORDINATES[createInstitutionDto.town] ?? null
      if (coordinates) country = 'Lebanon';
    }
    if (!coordinates) {
      throw new BadRequestException("Could not resolve a location from the provided address or town."); }
    const createdInstitution = new this.institutionModel({
      name: createInstitutionDto.name,
      type: createInstitutionDto.type,
      currency: 'USD', // Default currency, you can modify this as needed
      timezone: 'Asia/Beirut', // Default timezone, you can modify this as needed
      rite: createInstitutionDto.rite,
      country,
      admins: [], // Default empty admins array, you can modify this as needed
      location: { type: 'Point', coordinates: [coordinates.lng, coordinates.lat] }, // Set the coordinates based on the town
      maxAttendance: createInstitutionDto.maxAttendance,
      bufferMinutes: createInstitutionDto.bufferMinutes,
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
      filter.name = { $regex: escapeRegex(query.name), $options: 'i' };
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
    const session = await this.institutionModel.db.startSession();
    session.startTransaction();
    try {
      const institutionId = new Types.ObjectId(id);
      const result = await this.institutionModel.deleteOne(
        { _id: institutionId },
        { session },
      );
      if (result.deletedCount === 0) {
        throw new NotFoundException(`Institution with ID ${id} not found.`);
      }

      const affectedUsers = await this.userModel
        .find({ managedInstitutionIds: institutionId })
        .session(session);
      for (const user of affectedUsers) {
        user.managedInstitutionIds = user.managedInstitutionIds.filter(
          (managedId) => !managedId.equals(institutionId),
        );
        if (user.managedInstitutionIds.length === 0) {
          user.role = 'user';
        }
        await user.save({ session });
      }

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }

  async getNearbyInstitutions(
  lat: number,
  lng: number,
  maxDistance: number = 10000,
  rite?: string,
  includeAllCountries?: boolean,
): Promise<Institution[]> {
  const filter: any = {
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates: [lng, lat] },
        $maxDistance: maxDistance,
      },
    },
    
  };
  if (rite){
      filter.rite=rite;
    }
  if (isWithinLebanon(lat,lng)&&!includeAllCountries){
      filter.country='Lebanon';
    }
 

  return await this.institutionModel.find(filter).select('-admins').exec()
}

  async updateInstitution(
    institutionId: string,
    dto: UpdateInstitutionDto,
  ): Promise<Institution> {
    const institution = await this.institutionModel.findById(institutionId);
    if (!institution) {
      throw new NotFoundException(
        `Institution with ID ${institutionId} not found.`,
      );
    }

    // a DTO instance has every optional field as an own `undefined` property,
    // so only copy the fields that were actually sent
    const changes = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );
    Object.assign(institution, changes);
    await institution.save();

    return this.institutionModel
      .findById(institutionId)
      .select('-admins')
      .exec() as Promise<Institution>;
  }

  async deleteSalon(institutionId: string, salonId: string): Promise<void> {
    const institution = await this.institutionModel.findById(institutionId);
    if (!institution) {
      throw new NotFoundException(
        `Institution with ID ${institutionId} not found.`,
      );
    }

    const salonObjectId = new Types.ObjectId(salonId);
    const salon = institution.salons.find((s) =>
      (s as any)._id.equals(salonObjectId),
    );
    if (!salon) {
      throw new NotFoundException(
        `Salon with ID ${salonId} not found in this institution.`,
      );
    }

    // a salon with an upcoming requested or approved booking cannot be removed
    const blockingBooking = await this.bookingModel.findOne({
      institutionId: institution._id,
      salonId: salonObjectId,
      status: { $in: ['requested', 'approved'] },
      endsAt: { $gt: new Date() },
    });
    if (blockingBooking) {
      throw new ConflictException(
        'This salon has upcoming requested or approved bookings. Cancel or reject them first.',
      );
    }

    await this.institutionModel.updateOne(
      { _id: institutionId },
      { $pull: { salons: { _id: salonObjectId } } },
    );
  }
}
