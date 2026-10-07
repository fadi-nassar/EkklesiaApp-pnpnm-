import {
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
import { CreateSalonDto } from './dto/create-salon.dto.js';
import { UpdateSalonDto } from './dto/update-salon.dto.js';
import { escapeRegex } from '../../common/utils/escape-regex.js';
import {
  Booking,
  BookingDocument,
} from '../bookings/schema/booking.schema.js';

const DUPLICATE_SALON_MESSAGE =
  'A salon with this name already exists in this institution.';

@Injectable()
export class SalonsService {
  constructor(
    @InjectModel(Institution.name)
    private readonly institutionModel: Model<InstitutionDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
  ) {}

  async create(institutionId: string, dto: CreateSalonDto) {
    const salon = {
      _id: new Types.ObjectId(),
      name: dto.name,
      maxAttendance: dto.maxAttendance,
    };

    // one atomic update: push only if no salon with this name (any case) exists
    const updated = await this.institutionModel.findOneAndUpdate(
      {
        _id: institutionId,
        salons: {
          $not: {
            $elemMatch: {
              name: { $regex: `^${escapeRegex(dto.name)}$`, $options: 'i' },
            },
          },
        },
      },
      { $push: { salons: salon } },
      { new: true },
    );

    if (!updated) {
      // either the institution is missing or the name is taken
      const exists = await this.institutionModel.exists({ _id: institutionId });
      if (!exists) {
        throw new NotFoundException(
          `Institution with ID ${institutionId} not found.`,
        );
      }
      throw new ConflictException(DUPLICATE_SALON_MESSAGE);
    }
    return salon;
  }

  async update(institutionId: string, salonId: string, dto: UpdateSalonDto) {
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

    if (
      dto.name !== undefined &&
      institution.salons.some(
        (s) =>
          !(s as any)._id.equals(salonObjectId) &&
          s.name.toLowerCase() === dto.name!.toLowerCase(),
      )
    ) {
      throw new ConflictException(DUPLICATE_SALON_MESSAGE);
    }

    const set: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      set['salons.$.name'] = dto.name;
    }
    if (dto.maxAttendance !== undefined) {
      set['salons.$.maxAttendance'] = dto.maxAttendance;
    }
    if (Object.keys(set).length === 0) {
      return { _id: (salon as any)._id, name: salon.name, maxAttendance: salon.maxAttendance };
    }

    const updated = await this.institutionModel.findOneAndUpdate(
      { _id: institutionId, 'salons._id': salonObjectId },
      { $set: set },
      { new: true },
    );
    const result = updated?.salons.find((s) =>
      (s as any)._id.equals(salonObjectId),
    );
    if (!result) {
      throw new NotFoundException(
        `Salon with ID ${salonId} not found in this institution.`,
      );
    }
    return {
      _id: (result as any)._id,
      name: result.name,
      maxAttendance: result.maxAttendance,
    };
  }

  async deleteSalon(institutionId: string, salonId: string): Promise<void> {
    const institutionObjectId = new Types.ObjectId(institutionId);
    const salonObjectId = new Types.ObjectId(salonId);

    const institution = await this.institutionModel.findById(
      institutionObjectId,
    );
    if (!institution) {
      throw new NotFoundException(
        `Institution with ID ${institutionId} not found.`,
      );
    }

    const salon = institution.salons.find((s) =>
      (s as any)._id.equals(salonObjectId),
    );
    if (!salon) {
      throw new NotFoundException(
        `Salon with ID ${salonId} not found in this institution.`,
      );
    }

    const blockingBooking = await this.bookingModel.findOne({
      institutionId: institutionObjectId,
      salonId: salonObjectId,
      status: { $in: ['requested', 'approved'] },
      endsAt: { $gt: new Date() },
    });
    if (blockingBooking) {
      throw new ConflictException(
        'This salon has active or pending bookings and cannot be deleted.',
      );
    }

    await this.institutionModel.updateOne(
      { _id: institutionObjectId },
      { $pull: { salons: { _id: salonObjectId } } },
    );
  }
}
