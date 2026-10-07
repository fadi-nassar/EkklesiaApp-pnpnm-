// These helpers shell out to db-runner.cjs (a plain `node` child process)
// for every database operation instead of connecting to Mongo in-process —
// see db-runner.cjs for why: the mongodb driver's connection handshake is
// broken specifically when it runs inside Jest's module sandbox here.
import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export type ModelName =
  | 'Institution'
  | 'User'
  | 'Event'
  | 'News'
  | 'Follow'
  | 'Schedule'
  | 'ScheduleException'
  | 'Booking'
  | 'Notification';

type Op =
  | { action: 'insert'; model: ModelName; data: Record<string, unknown> }
  | { action: 'findById'; model: ModelName; id: string }
  | { action: 'find'; model: ModelName; filter: Record<string, unknown> }
  | { action: 'count'; model: ModelName; filter: Record<string, unknown> };

type OpResult = { ok: true; result: any } | { ok: false; error: string };

const RUNNER_PATH = join(__dirname, 'db-runner.cjs');

function runOps(ops: Op[]): any[] {
  const dir = mkdtempSync(join(tmpdir(), 'ekklesia-db-'));
  const inputPath = join(dir, 'input.json');
  const outputPath = join(dir, 'output.json');
  try {
    writeFileSync(inputPath, JSON.stringify(ops));
    execFileSync(process.execPath, [RUNNER_PATH, inputPath, outputPath], {
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    const results: OpResult[] = JSON.parse(readFileSync(outputPath, 'utf8'));
    return results.map((r) => {
      if (!r.ok) {
        throw new Error(`db op failed: ${r.error}`);
      }
      return r.result;
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function dbInsert(
  model: ModelName,
  data: Record<string, unknown>,
): Promise<any> {
  return runOps([{ action: 'insert', model, data }])[0];
}

export async function dbFindById(model: ModelName, id: string): Promise<any | null> {
  return runOps([{ action: 'findById', model, id }])[0];
}

export async function dbFind(
  model: ModelName,
  filter: Record<string, unknown> = {},
): Promise<any[]> {
  return runOps([{ action: 'find', model, filter }])[0];
}

export async function dbCount(
  model: ModelName,
  filter: Record<string, unknown> = {},
): Promise<number> {
  return runOps([{ action: 'count', model, filter }])[0];
}

// a tiny helper for tests that just want a fresh random-looking ObjectId-shaped
// string without caring what it resolves to (e.g. "an id that doesn't exist")
export function fakeObjectId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 24);
}
