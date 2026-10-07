import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument } from './schema/booking.schema.js';
import {
  Institution,
  InstitutionDocument,
} from '../institutions/schemas/institution.schema.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { CreateFuneralBookingDto } from './dto/create-funeral-booking.dto.js';
import { NotificationsService } from '../notifications/notifications.service.js';


@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Institution.name)
    private readonly institutionModel: Model<InstitutionDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async notifyBookingStatus(booking: Booking, title: string, body: string): Promise<void> {
    try {
      await this.notificationsService.createMany([booking.userId.toString()], {
        type: 'booking_status',
        title,
        body,
        refId: (booking as any)._id.toString(),
      });
    } catch (error) {
      this.logger.error(
        `Failed to notify booking status for booking ${(booking as any)._id}`,
        error as Error,
      );
    }
  }

  async createFuneral(
    userId: string,
    institutionId: string,
    dto: CreateFuneralBookingDto,
  ): Promise<Booking> {
    const institution = await this.institutionModel
      .findById(institutionId)
      .exec();
    if (!institution) {
      throw new NotFoundException('Institution not found');
    }
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (startsAt >= endsAt) {
      throw new BadRequestException('Start time must be before end time');
    }
    let capacity = institution.maxAttendance;
    if (dto.salonId) {
      const salonObjectId = new Types.ObjectId(dto.salonId);
      const salon = institution.salons.find((s) =>
        (s as any)._id.equals(salonObjectId),
      );
      if (!salon) {
        throw new BadRequestException('Salon not found in this institution');
      }
      capacity = salon.maxAttendance;
    }
    if (dto.headcount > capacity) {
      throw new BadRequestException(
        `Headcount exceeds maximum attendance of ${capacity}`,
      );
    }
    // no hasConflict: a funeral is admin-created and overrides existing bookings
    const booking = new this.bookingModel({
      userId: new Types.ObjectId(userId),
      institutionId: new Types.ObjectId(institutionId),
      bookingType: 'funeral',
      status: 'approved',
      salonId: dto.salonId ? new Types.ObjectId(dto.salonId) : undefined,
      startsAt,
      endsAt,
      headcount: dto.headcount,
      notes: dto.notes,
    });
    return booking.save();
  }

  async approve(institutionId: string, bookingId: string): Promise<Booking> {
    const booking = await this.bookingModel
      .findOne({
        _id: new Types.ObjectId(bookingId),
        institutionId: new Types.ObjectId(institutionId),
      })
      .exec();
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.status !== 'requested') {
      throw new BadRequestException(
        `A booking that is ${booking.status} cannot be approved`,
      );
    }
    const institution = await this.institutionModel
      .findById(institutionId)
      .exec();
    if (!institution) {
      throw new NotFoundException('Institution not found');
    }
    // must run before the status changes, otherwise the booking would conflict with itself
    const hasConflict = await this.hasConflict(
      institutionId,
      booking.salonId?.toString(),
      booking.startsAt,
      booking.endsAt,
      institution.bufferMinutes,
    );
    if (hasConflict) {
      throw new ConflictException('Booking conflicts with existing booking');
    }
    booking.status = 'approved';
    const saved = await booking.save();
    await this.notifyBookingStatus(
      saved,
      'Booking approved',
      `Your ${saved.bookingType} booking has been approved.`,
    );
    return saved;
  }

  async reject(institutionId: string, bookingId: string): Promise<Booking> {
    const booking = await this.bookingModel
      .findOne({
        _id: new Types.ObjectId(bookingId),
        institutionId: new Types.ObjectId(institutionId),
      })
      .exec();
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.status !== 'requested') {
      throw new BadRequestException(
        `A booking that is ${booking.status} cannot be rejected`,
      );
    }
    booking.status = 'rejected';
    const saved = await booking.save();
    await this.notifyBookingStatus(
      saved,
      'Booking rejected',
      `Your ${saved.bookingType} booking has been rejected.`,
    );
    return saved;
  }

  async adminCancel(institutionId: string, bookingId: string): Promise<Booking> {
    const booking = await this.bookingModel
      .findOne({
        _id: new Types.ObjectId(bookingId),
        institutionId: new Types.ObjectId(institutionId),
      })
      .exec();
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.status !== 'requested' && booking.status !== 'approved') {
      throw new ConflictException(
        `A booking that is ${booking.status} cannot be cancelled`,
      );
    }
    booking.status = 'cancelled';
    const saved = await booking.save();
    await this.notifyBookingStatus(
      saved,
      'Booking cancelled',
      `Your ${saved.bookingType} booking has been cancelled by the institution.`,
    );
    return saved;
  }

  async cancel(userId: string, bookingId: string): Promise<Booking> {
    // matching on userId is the ownership check
    const booking = await this.bookingModel
      .findOne({
        _id: new Types.ObjectId(bookingId),
        userId: new Types.ObjectId(userId),
      })
      .exec();
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }
    if (booking.status !== 'requested' && booking.status !== 'approved') {
      throw new BadRequestException(
        `A booking that is ${booking.status} cannot be cancelled`,
      );
    }
    booking.status = 'cancelled';
    return booking.save();
  }

  async findForInstitution(
    institutionId: string,
    query: { from?: string; to?: string; status?: string },
  ): Promise<Booking[]> {
    const filter: any = { institutionId: new Types.ObjectId(institutionId) };
    if (query.from || query.to) {
      filter.startsAt = {};
      if (query.from) filter.startsAt.$gte = new Date(query.from);
      if (query.to) filter.startsAt.$lte = new Date(query.to);
    }
    if (query.status) {
      filter.status = query.status;
    }
    return this.bookingModel.find(filter).sort({ startsAt: 1 }).exec();
  }

  async findMine(userId: string): Promise<Booking[]> {
    return this.bookingModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ startsAt: -1 })
      .exec();
  }
  private async hasConflict(
    institutionId: string,
    salonId: string | undefined,
    startsAt: Date,
    endsAt: Date,
    bufferMinutes: number,
  ): Promise<boolean>{
    const paddedStart=new Date(startsAt.getTime() - bufferMinutes * 60000);
    const paddedEnd=new Date(endsAt.getTime() + bufferMinutes * 60000);

    const filter: any = {
      institutionId: new Types.ObjectId(institutionId),
      startsAt: { $lt: paddedEnd },
      endsAt: { $gt: paddedStart },
      status:'approved',
      // null matches bookings with no salonId, i.e. the sanctuary
      salonId: salonId ? new Types.ObjectId(salonId) : null,
    };
    const conflictingBooking = await this.bookingModel.findOne(filter).exec();
    return !!conflictingBooking; 

    
  } 
  async createRequest(
    userId: string,
    institutionId: string,
    dto: CreateBookingDto,
  ): Promise<Booking> {
    const institution = await this.institutionModel
      .findById(institutionId)
      .exec();
    if (!institution) {
      throw new NotFoundException('Institution not found');
    }
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (startsAt >= endsAt) {
      throw new BadRequestException('Start time must be before end time');
    }
    if (startsAt < new Date()) {
      throw new BadRequestException('Start time cannot be in the past');
    }
    let capacity = institution.maxAttendance;
    if (dto.salonId) {
      const salonObjectId = new Types.ObjectId(dto.salonId);
      const salon = institution.salons.find((s) =>
        (s as any)._id.equals(salonObjectId),
      );
      if (!salon) {
        throw new BadRequestException('Salon not found in this institution');
      }
      capacity = salon.maxAttendance;
    }
    if (dto.headcount > capacity) {
      throw new BadRequestException(
        `Headcount exceeds maximum attendance of ${capacity}`,
      );
    }
    const hasConflict = await this.hasConflict(
      institutionId,
      dto.salonId,
      startsAt,
      endsAt,
      institution.bufferMinutes,
    );
    if (hasConflict) {
      throw new ConflictException('Booking conflicts with existing booking');
    }
    const booking = new this.bookingModel({
      userId: new Types.ObjectId(userId),
      institutionId: new Types.ObjectId(institutionId),
      bookingType: dto.bookingType,
      salonId: dto.salonId ? new Types.ObjectId(dto.salonId) : undefined,
      startsAt,
      endsAt,
      headcount: dto.headcount,
      notes: dto.notes,
    });
    return booking.save();
  }


}
