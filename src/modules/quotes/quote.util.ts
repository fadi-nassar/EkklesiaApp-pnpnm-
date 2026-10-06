export interface Verse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

// 1 for 1 January, up to 365 or 366, from the date's LOCAL year/month/day
export function getDayOfYear(date: Date): number {
  const startOfYear = Date.UTC(date.getFullYear(), 0, 0);
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((today - startOfYear) / 86400000);
}

export function pickVerseForDate(verses: Verse[], date: Date): Verse | null {
  if (verses.length === 0) {
    return null;
  }
  return verses[getDayOfYear(date) % verses.length];
}
