import { getNextOccurenceDate } from './schedule-utils.js';

// 5 Oct 2026 is a Monday (dayOfWeek 1). Every date is built with the local
// constructor so the tests do not depend on the machine's time zone.
// new Date(year, monthIndex, day, hour, minute, second, ms)
const MON = 1;
const WED = 3;
const SUN = 0;

describe('getNextOccurenceDate', () => {
  it('a. rule Monday 09:15, now Monday 10:10 -> next Monday 09:15', () => {
    const now = new Date(2026, 9, 5, 10, 10);
    const result = getNextOccurenceDate({ dayOfWeek: MON, time: '09:15' }, now);
    expect(result).toEqual(new Date(2026, 9, 12, 9, 15, 0, 0));
  });

  it('b. rule Monday 14:40, now Monday 15:30 -> next Monday 14:40', () => {
    const now = new Date(2026, 9, 5, 15, 30);
    const result = getNextOccurenceDate({ dayOfWeek: MON, time: '14:40' }, now);
    expect(result).toEqual(new Date(2026, 9, 12, 14, 40, 0, 0));
  });

  it('c. rule Monday 09:15, now Monday 08:00 -> today 09:15', () => {
    const now = new Date(2026, 9, 5, 8, 0);
    const result = getNextOccurenceDate({ dayOfWeek: MON, time: '09:15' }, now);
    expect(result).toEqual(new Date(2026, 9, 5, 9, 15, 0, 0));
  });

  it('d. rule Monday 10:00, now Monday 10:00:30 -> next Monday 10:00', () => {
    const now = new Date(2026, 9, 5, 10, 0, 30);
    const result = getNextOccurenceDate({ dayOfWeek: MON, time: '10:00' }, now);
    expect(result).toEqual(new Date(2026, 9, 12, 10, 0, 0, 0));
  });

  it('d2. rule at exactly the current minute (now 10:00:00.000) counts as already started', () => {
    const now = new Date(2026, 9, 5, 10, 0, 0, 0);
    const result = getNextOccurenceDate({ dayOfWeek: MON, time: '10:00' }, now);
    expect(result).toEqual(new Date(2026, 9, 12, 10, 0, 0, 0));
  });

  it('e. rule Wednesday 18:00, now Monday 10:00 -> that Wednesday', () => {
    const now = new Date(2026, 9, 5, 10, 0);
    const result = getNextOccurenceDate({ dayOfWeek: WED, time: '18:00' }, now);
    expect(result).toEqual(new Date(2026, 9, 7, 18, 0, 0, 0));
  });

  it('f. rule Sunday 09:00, now Monday 10:00 -> next Sunday', () => {
    const now = new Date(2026, 9, 5, 10, 0);
    const result = getNextOccurenceDate({ dayOfWeek: SUN, time: '09:00' }, now);
    expect(result).toEqual(new Date(2026, 9, 11, 9, 0, 0, 0));
  });

  it('g. seconds and milliseconds are 0, and `now` differing only in seconds gives equal dates', () => {
    const rule = { dayOfWeek: WED, time: '18:00' };
    const r1 = getNextOccurenceDate(rule, new Date(2026, 9, 5, 10, 0, 5, 123));
    const r2 = getNextOccurenceDate(rule, new Date(2026, 9, 5, 10, 0, 47, 900));
    expect(r1.getSeconds()).toBe(0);
    expect(r1.getMilliseconds()).toBe(0);
    expect(r2.getSeconds()).toBe(0);
    expect(r2.getMilliseconds()).toBe(0);
    expect(r1.getTime()).toBe(r2.getTime());
  });

  it('g2. same for a rule that is later today and one that already passed today', () => {
    const later = { dayOfWeek: MON, time: '23:30' };
    const passed = { dayOfWeek: MON, time: '09:00' };
    const a = new Date(2026, 9, 5, 10, 0, 5, 111);
    const b = new Date(2026, 9, 5, 10, 0, 50, 999);
    expect(getNextOccurenceDate(later, a).getTime()).toBe(
      getNextOccurenceDate(later, b).getTime(),
    );
    expect(getNextOccurenceDate(passed, a).getTime()).toBe(
      getNextOccurenceDate(passed, b).getTime(),
    );
  });

  it('h. the input `now` object is not mutated', () => {
    const now = new Date(2026, 9, 5, 10, 10, 33, 444);
    const before = now.getTime();
    getNextOccurenceDate({ dayOfWeek: WED, time: '18:00' }, now);
    getNextOccurenceDate({ dayOfWeek: MON, time: '09:15' }, now);
    expect(now.getTime()).toBe(before);
  });
});
