// Shared between global-setup/global-teardown (which boot a real server
// instance for the integration suite) and the spec files (which talk to it
// over HTTP). Kept dependency-free (no @nestjs/* imports) so it loads fine
// under plain CommonJS/ts-jest without touching the ESM-only Nest packages.
export const TEST_PORT = 3999;
export const TEST_BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
export const API = `${TEST_BASE_URL}/v1`;
export const TEST_MONGO_URI =
  'mongodb://127.0.0.1:27017/ekklesia_test?replicaSet=rs0';
