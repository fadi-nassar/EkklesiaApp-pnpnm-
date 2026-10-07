import 'dotenv/config';

// Shared between global-setup/global-teardown (which boot a real server
// instance for the integration suite) and the spec files (which talk to it
// over HTTP). Kept dependency-free (no @nestjs/* imports) so it loads fine
// under plain CommonJS/ts-jest without touching the ESM-only Nest packages.
export const TEST_PORT = 3999;
export const TEST_BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
export const API = `${TEST_BASE_URL}/v1`;

// same Mongo instance/credentials as the app's own MONGO_URI, pointed at a
// separate database so the suite never touches dev data
function testMongoUri(): string {
  const user = process.env.MONGO_ROOT_USERNAME;
  const pass = process.env.MONGO_ROOT_PASSWORD;
  if (!user || !pass) {
    throw new Error(
      'MONGO_ROOT_USERNAME/MONGO_ROOT_PASSWORD must be set (see .env) to run the e2e suite.',
    );
  }
  return `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@127.0.0.1:27017/ekklesia_test?replicaSet=rs0&authSource=admin`;
}

export const TEST_MONGO_URI = testMongoUri();
