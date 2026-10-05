export function applyTimeOverride(date: Date, time: string): Date {
  const [hourStr, minuteStr] = time.split(':');
  const result = new Date(date);
  result.setHours(Number(hourStr), Number(minuteStr), 0, 0);
  return result;
}

export function getNextOccurenceDate(
  rule: { dayOfWeek: number; time: string },
  now: Date,
): Date {
  const daysUntil = (rule.dayOfWeek - now.getDay() + 7) % 7;
  const [hourStr, minuteStr] = rule.time.split(':');
  const ruleHour = Number(hourStr);
  const ruleMinute = Number(minuteStr);
  const result = new Date(now);
  result.setDate(result.getDate() + daysUntil);
  result.setHours(ruleHour, ruleMinute, 0, 0);
  // a candidate that is not after now has already started: use next week's
  if (result.getTime() <= now.getTime()) {
    result.setDate(result.getDate() + 7);
  }
  return result;
}
