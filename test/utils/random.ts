import { randomUUID } from 'crypto';

export function uniqueEmail(prefix: string): string {
  return `${prefix}.${randomUUID()}@test.ekklesia.local`;
}

export function uniqueSuffix(): string {
  return randomUUID();
}
