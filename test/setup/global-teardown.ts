import 'dotenv/config';
import mongoose from 'mongoose';

// see global-setup.ts for why this constant is duplicated rather than imported
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
const TEST_MONGO_URI = testMongoUri();

export default async function globalTeardown(): Promise<void> {
  const child = (globalThis as any).__EKKLESIA_TEST_SERVER__ as
    | import('child_process').ChildProcess
    | undefined;

  if (child && !child.killed) {
    child.kill();
    await new Promise((resolve) => child.once('exit', resolve));
  }

  // leave no trace on the shared mongod instance between runs
  const connection = await mongoose.createConnection(TEST_MONGO_URI).asPromise();
  await connection.dropDatabase();
  await connection.close();
}
