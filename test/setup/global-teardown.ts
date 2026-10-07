import mongoose from 'mongoose';

// see global-setup.ts for why this constant is duplicated rather than imported
const TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/ekklesia_test?replicaSet=rs0';

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
