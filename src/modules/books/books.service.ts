import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Book, BookDocument } from './schema/book.schema.js';
import { CreateBookDto } from './dto/create-book.dto.js';
import { UpdateBookDto } from './dto/update-book.dto.js';
import { QueryBooksDto } from './dto/query-books.dto.js';
import { escapeRegex } from '../../common/utils/escape-regex.js';

@Injectable()
export class BooksService {
  constructor(
    @InjectModel(Book.name)
    private readonly bookModel: Model<BookDocument>,
  ) {}

  async create(dto: CreateBookDto): Promise<Book> {
    const created = new this.bookModel(dto);
    return created.save();
  }

  async findAll(query: QueryBooksDto): Promise<Book[]> {
    const filter: any = {};
    if (query.search) {
      const pattern = { $regex: escapeRegex(query.search), $options: 'i' };
      filter.$or = [{ title: pattern }, { author: pattern }];
    }
    if (query.prayerType) {
      filter.prayerType = query.prayerType;
    }
    return this.bookModel.find(filter).sort({ title: 1 }).exec();
  }

  async findOne(id: string): Promise<Book> {
    const book = await this.bookModel.findById(id);
    if (!book) {
      throw new NotFoundException(`Book with ID ${id} not found.`);
    }
    return book;
  }

  async update(id: string, dto: UpdateBookDto): Promise<Book> {
    const book = await this.bookModel.findById(id);
    if (!book) {
      throw new NotFoundException(`Book with ID ${id} not found.`);
    }
    // a DTO instance has every optional field as an own `undefined` property,
    // so only copy the fields that were actually sent
    const changes = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );
    Object.assign(book, changes);
    return book.save();
  }

  async remove(id: string): Promise<void> {
    const result = await this.bookModel.deleteOne({ _id: id });
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Book with ID ${id} not found.`);
    }
  }
}
