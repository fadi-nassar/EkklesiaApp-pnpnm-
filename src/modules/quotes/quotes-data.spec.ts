import { readFileSync } from 'fs';
import { join } from 'path';

interface VerseEntry {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

const verses: VerseEntry[] = JSON.parse(
  readFileSync(join(__dirname, 'data', 'verses.json'), 'utf8'),
);

describe('quotes verses.json', () => {
  it('has between 100 and 365 entries', () => {
    expect(verses.length).toBeGreaterThanOrEqual(100);
    expect(verses.length).toBeLessThanOrEqual(365);
  });

  it('every entry has non-empty Arabic text and a valid reference', () => {
    const books = ['المزامير', 'الأمثال', 'متى', 'مرقس', 'لوقا', 'يوحنا'];
    for (const v of verses) {
      expect(typeof v.text).toBe('string');
      expect(v.text.trim().length).toBeGreaterThan(0);
      expect(v.text).toMatch(/[؀-ۿ]/);
      expect(books).toContain(v.book);
      expect(Number.isInteger(v.chapter) && v.chapter > 0).toBe(true);
      expect(Number.isInteger(v.verse) && v.verse > 0).toBe(true);
    }
  });

  it('every text is 25 to 180 characters', () => {
    for (const v of verses) {
      expect(v.text.length).toBeGreaterThanOrEqual(25);
      expect(v.text.length).toBeLessThanOrEqual(180);
    }
  });

  it('has no duplicate references', () => {
    const refs = new Set(verses.map((v) => `${v.book} ${v.chapter}:${v.verse}`));
    expect(refs.size).toBe(verses.length);
  });

  it('every verse has as many « as »', () => {
    const count = (s: string, ch: string) => s.split(ch).length - 1;
    for (const v of verses) {
      expect(count(v.text, '«')).toBe(count(v.text, '»'));
    }
  });
});
