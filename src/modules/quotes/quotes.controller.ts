import { Controller, Get } from '@nestjs/common';
import { QuotesService } from './quotes.service.js';

@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  //for anyone
  @Get('today')
  getToday() {
    return this.quotesService.getToday();
  }
}
