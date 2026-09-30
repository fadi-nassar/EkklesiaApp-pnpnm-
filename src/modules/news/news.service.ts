import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { News, NewsDocument } from './schema/news.schema.js';
import {
  Institution,
  InstitutionDocument,
} from '../institutions/schemas/institution.schema.js';
import { CreateNewsDto } from './dto/create-news.dto.js';
import { UpdateNewsDto } from './dto/update-news.dto.js';

@Injectable()
export class NewsService {
  constructor(
    @InjectModel(News.name)
    private readonly newsModel: Model<NewsDocument>,
    @InjectModel(Institution.name)
    private readonly institutionModel: Model<InstitutionDocument>,
  ) {}

  async create(institutionId: string, dto: CreateNewsDto): Promise<News> {
    const institution = await this.institutionModel.findById(institutionId);
    if (!institution) {
      throw new NotFoundException(
        `Institution with ID ${institutionId} not found.`,
      );
    }

    const created = new this.newsModel({
      institutionId,
      title: dto.title,
      body: dto.body,
      image: dto.image,
      publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : new Date(),
    });
    return created.save();
  }

  async findAllForInstitution(
    institutionId: string,
    query: { from?: string; to?: string },
  ): Promise<News[]> {
    const fromDate = query.from ? new Date(query.from) : new Date(0);
    const toDate = query.to ? new Date(query.to) : new Date(8640000000000000);
    return this.newsModel
      .find({
        institutionId,
        publishedAt: { $gte: fromDate, $lte: toDate },
      })
      .sort({ publishedAt: -1 })
      .exec();
  }

  async findOne(id: string): Promise<News> {
    const news = await this.newsModel.findById(id);
    if (!news) {
      throw new NotFoundException(`News with ID ${id} not found.`);
    }
    return news;
  }

  async update(
    institutionId: string,
    id: string,
    dto: UpdateNewsDto,
  ): Promise<News> {
    const news = await this.newsModel.findOne({ _id: id, institutionId });
    if (!news) {
      throw new NotFoundException(
        `News with ID ${id} not found for this institution.`,
      );
    }

    if (dto.title !== undefined) {
      news.title = dto.title;
    }
    if (dto.body !== undefined) {
      news.body = dto.body;
    }
    if (dto.image !== undefined) {
      news.image = dto.image;
    }
    if (dto.publishedAt !== undefined) {
      news.publishedAt = new Date(dto.publishedAt);
    }

    return news.save();
  }

  async remove(institutionId: string, id: string): Promise<void> {
    const result = await this.newsModel.deleteOne({ _id: id, institutionId });
    if (result.deletedCount === 0) {
      throw new NotFoundException(
        `News with ID ${id} not found for this institution.`,
      );
    }
  }
}
