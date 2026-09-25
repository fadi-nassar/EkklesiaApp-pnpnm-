/**
 * Standalone DB seed script — connects directly with mongoose, no Nest app context.
 * Run with: pnpm run seed
 *
 * Idempotent: matches on the same unique fields the schemas enforce (email for
 * users, name for institutions) and skips anything that already exists.
 */
import 'dotenv/config';
import mongoose, { Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import {
  Institution,
  InstitutionSchema,
} from '../modules/institutions/schemas/institution.schema.js';
import { User, UserSchema } from '../modules/users/schema/user.schema.js';

const BCRYPT_COST = 12;

interface SeedInstitution {
  name: string;
  type: string;
  rite: string;
  currency: string;
  timezone: string;
  location: { type: 'Point'; coordinates: [number, number] };
}

interface SeedUser {
  username: string;
  email: string;
  password: string;
  role: string;
  rite: string;
}

const institutionsToSeed: SeedInstitution[] = [
  {
    name: 'St. George Orthodox Church',
    type: 'church',
    rite: 'orthodox',
    currency: 'USD',
    timezone: 'Asia/Beirut',
    location: { type: 'Point', coordinates: [35.8528, 34.3017] },
  },
  {
    name: 'Kousba Monastery',
    type: 'monastery',
    rite: 'orthodox',
    currency: 'USD',
    timezone: 'Asia/Beirut',
    location: { type: 'Point', coordinates: [35.8528, 34.3017] },
  },
];

const usersToSeed: SeedUser[] = [
  {
    username: 'superadmin',
    email: 'superadmin@ekklesia.dev',
    password: 'SuperAdmin123!',
    role: 'superAdmin',
    rite: 'orthodox',
  },
  {
    username: 'testuser',
    email: 'testuser@ekklesia.dev',
    password: 'TestUser123!',
    role: 'user',
    rite: 'orthodox',
  },
];

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is not set. Check your .env file.');
  }

  await mongoose.connect(mongoUri);

  const institutionModel = mongoose.model(Institution.name, InstitutionSchema);
  const userModel = mongoose.model(User.name, UserSchema);

  const createdInstitutions: string[] = [];
  const skippedInstitutions: string[] = [];

  for (const seedInstitution of institutionsToSeed) {
    const existing = await institutionModel.findOne({
      name: seedInstitution.name,
    });
    if (existing) {
      skippedInstitutions.push(seedInstitution.name);
      continue;
    }
    await institutionModel.create({
      name: seedInstitution.name,
      type: seedInstitution.type,
      rite: seedInstitution.rite,
      currency: seedInstitution.currency,
      timezone: seedInstitution.timezone,
      admins: [],
      location: seedInstitution.location,
    });
    createdInstitutions.push(seedInstitution.name);
  }

  const homeInstitution = await institutionModel.findOne({
    name: institutionsToSeed[0].name,
  });
  if (!homeInstitution) {
    throw new Error(
      `Could not find or create institution "${institutionsToSeed[0].name}" to use as homeInstitutionId.`,
    );
  }
  const homeInstitutionId = homeInstitution._id as Types.ObjectId;

  const createdUsers: string[] = [];
  const skippedUsers: string[] = [];
  const credentials: { email: string; password: string }[] = [];

  for (const seedUser of usersToSeed) {
    const existing = await userModel.findOne({ email: seedUser.email });
    if (existing) {
      skippedUsers.push(seedUser.email);
      continue;
    }
    const passwordHash = await bcrypt.hash(seedUser.password, BCRYPT_COST);
    await userModel.create({
      username: seedUser.username,
      email: seedUser.email,
      passwordHash,
      homeInstitutionId,
      role: seedUser.role,
      rite: seedUser.rite,
      managedInstitutionIds: [],
    });
    createdUsers.push(seedUser.email);
    credentials.push({ email: seedUser.email, password: seedUser.password });
  }

  console.log('\n--- Seed summary ---');
  console.log(
    `Institutions created: ${createdInstitutions.length ? createdInstitutions.join(', ') : 'none'}`,
  );
  console.log(
    `Institutions skipped (already existed): ${skippedInstitutions.length ? skippedInstitutions.join(', ') : 'none'}`,
  );
  console.log(
    `Users created: ${createdUsers.length ? createdUsers.join(', ') : 'none'}`,
  );
  console.log(
    `Users skipped (already existed): ${skippedUsers.length ? skippedUsers.join(', ') : 'none'}`,
  );

  if (credentials.length) {
    console.log('\n--- Login credentials (for newly created users only) ---');
    for (const cred of credentials) {
      console.log(`  email: ${cred.email}  password: ${cred.password}`);
    }
  } else {
    console.log(
      '\nNo new users created — reusing the credentials from the previous seed run:',
    );
    for (const seedUser of usersToSeed) {
      console.log(`  email: ${seedUser.email}  password: ${seedUser.password}`);
    }
  }
  console.log('');

  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('Seed script failed:', err);
    await mongoose.disconnect();
    process.exit(1);
  });
