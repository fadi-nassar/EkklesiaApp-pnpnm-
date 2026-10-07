// computes UTC instants for calendar-day boundaries in an IANA time zone, DST-safe

function offsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const hour = get('hour') % 24;
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  return (asUtc - date.getTime()) / 60000;
}

function zonedMidnightToUtc(year: number, month: number, day: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offset = offsetMinutes(new Date(guess), timeZone);
  const utc = guess - offset * 60000;
  // re-derive in case the first guess landed on the other side of a DST transition
  const offset2 = offsetMinutes(new Date(utc), timeZone);
  return new Date(guess - offset2 * 60000);
}

// [start, end) UTC instants for the calendar day `daysFromToday` days from now, in `timeZone`
export function getDayRangeInTimeZone(
  daysFromToday: number,
  timeZone: string,
  now: Date = new Date(),
): { start: Date; end: Date } {
  const todayParts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => Number(todayParts.find((p) => p.type === type)?.value);
  const todayUtcMidnight = Date.UTC(get('year'), get('month') - 1, get('day'));
  const target = new Date(todayUtcMidnight);
  target.setUTCDate(target.getUTCDate() + daysFromToday);

  const start = zonedMidnightToUtc(
    target.getUTCFullYear(),
    target.getUTCMonth() + 1,
    target.getUTCDate(),
    timeZone,
  );
  const next = new Date(target);
  next.setUTCDate(next.getUTCDate() + 1);
  const end = zonedMidnightToUtc(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    timeZone,
  );
  return { start, end };
}
