import { getDayOfYear, pickVerseForDate, Verse } from './quote.util.js';

// placeholder entries only: these are not Bible text
const verses: Verse[] = Array.from({ length: 365 }, (_, i) => ({
  book: 'test',
  chapter: 1,
  verse: i + 1,
  text: `placeholder ${i + 1}`,
}));

describe('quote day-of-year picking', () => {
  it('1 January is day 1 and 31 December 2026 is day 365', () => {
    expect(getDayOfYear(new Date(2026, 0, 1))).toBe(1);
    expect(getDayOfYear(new Date(2026, 11, 31))).toBe(365);
  });

  it('31 December of a leap year is day 366', () => {
    expect(getDayOfYear(new Date(2028, 11, 31))).toBe(366);
  });

  it('the same local day gives the same verse at any time of day', () => {
    const morning = pickVerseForDate(verses, new Date(2026, 9, 5, 0, 0, 1));
    const night = pickVerseForDate(verses, new Date(2026, 9, 5, 23, 59, 59));
    expect(morning).toEqual(night);
  });

  it('uses dayOfYear % length, so the index wraps', () => {
    // day 366 of 2028 wraps to index 1 of a 365-verse list
    expect(pickVerseForDate(verses, new Date(2028, 11, 31))).toBe(verses[1]);
    expect(pickVerseForDate(verses, new Date(2026, 0, 1))).toBe(verses[1]);
  });

  it('returns null for an empty list', () => {
    expect(pickVerseForDate([], new Date(2026, 9, 5))).toBeNull();
  });
});
