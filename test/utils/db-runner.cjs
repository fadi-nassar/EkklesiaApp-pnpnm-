// Plain CommonJS script, executed with a bare `node` (never through ts-jest).
//
// The MongoDB Node driver fails its connection handshake when it runs inside
// Jest's module sandbox in this project's toolchain (jest-circus + ts-jest):
// the server rejects it with "Missing required sub-document 'driver' in the
// client metadata document" (code 183, ClientMetadataMissingField), which
// then stalls every test that touches the database until the hook timeout.
// The same mongoose code runs fine as an ordinary `node script.js` process
// (verified independently of Jest), so database access for these tests is
// shelled out to this script instead of running in-process. See
// test/utils/db.ts for the Jest-side caller.
require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');

// same Mongo instance/credentials as the app's own MONGO_URI (see .env),
// pointed at a separate database so the suite never touches dev data
function testMongoUri() {
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

const SalonSchema = new mongoose.Schema(
  { name: String, maxAttendance: Number },
  { _id: true },
);

const InstitutionSchema = new mongoose.Schema(
  {
    name: String,
    type: String,
    currency: String,
    timezone: String,
    admins: [mongoose.Schema.Types.ObjectId],
    location: {
      type: { type: String, default: 'Point' },
      coordinates: [Number],
    },
    rite: String,
    country: String,
    maxAttendance: Number,
    bufferMinutes: { type: Number, default: 30 },
    salons: [SalonSchema],
    followerCount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'institutions' },
);

const UserSchema = new mongoose.Schema(
  {
    username: String,
    email: String,
    passwordHash: String,
    homeInstitutionId: mongoose.Schema.Types.ObjectId,
    role: String,
    managedInstitutionIds: [mongoose.Schema.Types.ObjectId],
    rite: String,
  },
  { timestamps: true, collection: 'users' },
);

const EventSchema = new mongoose.Schema(
  {
    institutionId: mongoose.Schema.Types.ObjectId,
    title: String,
    description: String,
    image: String,
    startsAt: Date,
    endsAt: Date,
    likeCount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'events' },
);

const NewsSchema = new mongoose.Schema(
  {
    institutionId: mongoose.Schema.Types.ObjectId,
    title: String,
    body: String,
    publishedAt: Date,
    likeCount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'news' },
);

const FollowSchema = new mongoose.Schema(
  { userId: mongoose.Schema.Types.ObjectId, institutionId: mongoose.Schema.Types.ObjectId },
  { timestamps: true, collection: 'follows' },
);

const ScheduleSchema = new mongoose.Schema(
  {
    institutionId: mongoose.Schema.Types.ObjectId,
    dayOfWeek: Number,
    time: String,
    serviceType: String,
  },
  { timestamps: true, collection: 'schedules' },
);

const ScheduleExceptionSchema = new mongoose.Schema(
  {
    institutionId: mongoose.Schema.Types.ObjectId,
    date: Date,
    action: String,
    time: String,
    serviceType: String,
  },
  { timestamps: true, collection: 'scheduleexceptions' },
);

const BookingSchema = new mongoose.Schema(
  {
    userId: mongoose.Schema.Types.ObjectId,
    institutionId: mongoose.Schema.Types.ObjectId,
    bookingType: String,
    salonId: mongoose.Schema.Types.ObjectId,
    startsAt: Date,
    endsAt: Date,
    headcount: Number,
    status: String,
    notes: String,
  },
  { timestamps: true, collection: 'bookings' },
);

const NotificationSchema = new mongoose.Schema(
  {
    userId: mongoose.Schema.Types.ObjectId,
    type: String,
    title: String,
    body: String,
    refId: mongoose.Schema.Types.ObjectId,
    read: Boolean,
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'notifications' },
);

const SCHEMAS = {
  Institution: InstitutionSchema,
  User: UserSchema,
  Event: EventSchema,
  News: NewsSchema,
  Follow: FollowSchema,
  Schedule: ScheduleSchema,
  ScheduleException: ScheduleExceptionSchema,
  Booking: BookingSchema,
  Notification: NotificationSchema,
};

function serialize(value) {
  return JSON.parse(JSON.stringify(value));
}

async function runOp(models, op) {
  const Model = models[op.model];
  if (!Model) {
    throw new Error(`Unknown model: ${op.model}`);
  }
  switch (op.action) {
    case 'insert': {
      const doc = await Model.create(op.data);
      return serialize(doc.toObject());
    }
    case 'findById': {
      const doc = await Model.findById(op.id);
      return doc ? serialize(doc.toObject()) : null;
    }
    case 'find': {
      const docs = await Model.find(op.filter || {});
      return docs.map((d) => serialize(d.toObject()));
    }
    case 'count': {
      return Model.countDocuments(op.filter || {});
    }
    default:
      throw new Error(`Unknown action: ${op.action}`);
  }
}

async function main() {
  const [, , inputPath, outputPath] = process.argv;
  const ops = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  const connection = await mongoose.createConnection(TEST_MONGO_URI).asPromise();
  const models = {};
  for (const [name, schema] of Object.entries(SCHEMAS)) {
    models[name] = connection.model(name, schema);
  }

  const results = [];
  for (const op of ops) {
    try {
      results.push({ ok: true, result: await runOp(models, op) });
    } catch (error) {
      results.push({ ok: false, error: error.message });
    }
  }

  await connection.close();
  fs.writeFileSync(outputPath, JSON.stringify(results));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
