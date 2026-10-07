import { execSync, spawn } from 'child_process';

// Jest loads globalSetup/globalTeardown outside the normal module graph (no
// moduleNameMapper there), so these two files inline the shared constants
// instead of importing them from server-config.ts.
const TEST_PORT = 3999;
const TEST_BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/ekklesia_test?replicaSet=rs0';

// Nest's own packages (@nestjs/core, @nestjs/testing, ...) are published as
// ESM-only, which Jest's CommonJS runtime cannot require() without a lot of
// extra ceremony (and, in this dependency graph, an unresolvable require
// cycle). So instead of booting the app in-process via @nestjs/testing, the
// integration suite builds the real project and runs the compiled server as
// a separate process, then talks to it over plain HTTP with supertest — a
// more faithful end-to-end test anyway (real global pipes, guards, filters,
// throttler, the works).
async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.status === 200 || res.status === 503) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(
    `Server did not become ready within ${timeoutMs}ms: ${String(lastError)}`,
  );
}

export default async function globalSetup(): Promise<void> {
  execSync('pnpm run build', { stdio: 'inherit', cwd: process.cwd() });

  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      MONGO_URI: TEST_MONGO_URI,
      APP_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout?.on('data', (chunk) => (output += chunk.toString()));
  child.stderr?.on('data', (chunk) => (output += chunk.toString()));

  (globalThis as any).__EKKLESIA_TEST_SERVER__ = child;

  try {
    await waitForServer(`${TEST_BASE_URL}/health`, 30000);
  } catch (error) {
    child.kill();
    throw new Error(`${(error as Error).message}\n--- server output ---\n${output}`);
  }
}
