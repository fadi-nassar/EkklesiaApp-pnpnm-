import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Book, BookSchema } from './schema/book.schema.js';
import { BooksService } from './books.service.js';
import { BooksController } from './books.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Book.name, schema: BookSchema }]),
    AuthModule,
  ],
  providers: [BooksService],
  controllers: [BooksController],
})
export class BooksModule {}
