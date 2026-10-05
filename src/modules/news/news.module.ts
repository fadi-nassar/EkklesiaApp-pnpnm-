import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { News, NewsSchema } from './schema/news.schema.js';
import {
  Institution,
  InstitutionSchema,
} from '../institutions/schemas/institution.schema.js';
import { NewsService } from './news.service.js';
import { NewsController } from './news.controller.js';
import { InstitutionNewsController } from './institution-news.controller.js';
import { AdminGuard } from '../../common/guards/admin-guard.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: News.name, schema: NewsSchema },
      { name: Institution.name, schema: InstitutionSchema },
    ]),
    AuthModule,
  ],
  exports: [MongooseModule, NewsService],
  providers: [AdminGuard, NewsService],
  controllers: [NewsController, InstitutionNewsController],
})
export class NewsModule {}
