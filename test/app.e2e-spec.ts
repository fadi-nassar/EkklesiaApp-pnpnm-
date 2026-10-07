import request from 'supertest';
import { TEST_BASE_URL } from './setup/server-config.js';

// Talks to the real server process booted in global-setup.ts rather than
// building a Nest TestingModule in-process: @nestjs/testing (and the rest of
// @nestjs/*) are ESM-only packages that Jest's CommonJS runtime cannot
// require() in this project's current toolchain (ts-jest/Jest 30, no
// package.json "type": "module"). See global-setup.ts for the full reasoning.
describe('HealthController (e2e)', () => {
  it('/health (GET)', async () => {
    const res = await request(TEST_BASE_URL).get('/health');
    expect([200, 503]).toContain(res.status);
  });
});
