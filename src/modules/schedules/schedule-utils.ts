export function applyTimeOverride(date: Date, time: string): Date {
  const [hourStr, minuteStr] = time.split(':');
  const result = new Date(date);
  result.setHours(Number(hourStr), Number(minuteStr));
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
  if (
    daysUntil === 0 &&
    now.getHours() >= ruleHour &&
    now.getMinutes() >= ruleMinute
  ) {
    result.setDate(result.getDate() + 7);
  }
  result.setHours(ruleHour, ruleMinute);
  return result;
}
