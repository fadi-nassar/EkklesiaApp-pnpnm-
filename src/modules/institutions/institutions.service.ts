import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Institution, InstitutionDocument } from './schemas/institution.schema.js';
import { CreateInstitutionDto } from './dto/create-institution.dto.js';

const TOWN_COORDINATES: Record<string, { lng: number; lat: number }> = {
      Kousba: { lng: 35.8528, lat: 34.3017 },
    };


@Injectable()
export class InstitutionsService {
  constructor(
    @InjectModel(Institution.name)
    private readonly institutionModel: Model<InstitutionDocument>,
  ) {}
    

  async createInstitution(createInstitutionDto: CreateInstitutionDto): Promise<Institution> {
    if (!TOWN_COORDINATES[createInstitutionDto.town]) {
      throw new BadRequestException(`Coordinates for town ${createInstitutionDto.town} not found.`);
    }
    const { lng, lat } = TOWN_COORDINATES[createInstitutionDto.town];
    const createdInstitution = new this.institutionModel({
      name : createInstitutionDto.name,
      type : createInstitutionDto.type,
      currency : 'USD', // Default currency, you can modify this as needed
      timezone : 'Asia/Beirut', // Default timezone, you can modify this as needed
      rite : createInstitutionDto.rite,
      admins : [], // Default empty admins array, you can modify this as needed
      location : { type: 'Point', coordinates: [lng, lat] }, // Set the coordinates based on the town
    });
    return createdInstitution.save();
  }
}

