import { Module } from '@nestjs/common';
import { QuotesService } from './quotes.service.js';
import { QuotesController } from './quotes.controller.js';

@Module({
  providers: [QuotesService],
  controllers: [QuotesController],
})
export class QuotesModule {}
