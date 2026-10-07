// parses simple duration strings ("30d", "15m", "1h", "45s") into milliseconds,
// falling back to defaultMs when the value is missing or not in that format
const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export function parseDurationMs(value: string | undefined, defaultMs: number): number {
  if (!value) return defaultMs;
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) return defaultMs;
  const [, amount, unit] = match;
  return Number(amount) * UNIT_MS[unit];
}
