import { Injectable, NotFoundException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { pickVerseForDate, Verse } from './quote.util.js';

@Injectable()
export class QuotesService {
  private readonly verses: Verse[] = JSON.parse(
    readFileSync(join(__dirname, 'data', 'verses.json'), 'utf8'),
  );

  getToday(): Verse {
    const verse = pickVerseForDate(this.verses, new Date());
    if (!verse) {
      throw new NotFoundException('No verses are available.');
    }
    return verse;
  }
}
