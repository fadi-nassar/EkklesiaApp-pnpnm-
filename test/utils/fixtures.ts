import { dbInsert } from './db.js';
import { uniqueEmail, uniqueSuffix } from './random.js';
import { signAccessToken } from './auth.js';

export interface TestUser {
  userId: string;
  accessToken: string;
  email: string;
}

export async function createInstitution(
  overrides: Partial<{ maxAttendance: number; bufferMinutes: number }> = {},
): Promise<{ _id: string }> {
  return dbInsert('Institution', {
    name: `Test Institution ${uniqueSuffix()}`,
    type: 'church',
    currency: 'USD',
    timezone: 'Asia/Beirut',
    admins: [],
    location: { type: 'Point', coordinates: [35.8528, 34.3017] },
    rite: 'orthodox',
    country: 'Lebanon',
    maxAttendance: overrides.maxAttendance ?? 200,
    bufferMinutes: overrides.bufferMinutes ?? 30,
    salons: [],
  });
}

// password/hash are irrelevant here: fixtures sign an access token directly
// (see auth.ts) instead of going through POST /auth/login, so a placeholder
// hash just satisfies the User schema's required field
async function createUserDoc(
  role: string,
  homeInstitutionId: string,
  emailPrefix: string,
): Promise<TestUser> {
  const email = uniqueEmail(emailPrefix);
  const user = await dbInsert('User', {
    username: `${emailPrefix}-${uniqueSuffix()}`,
    email,
    passwordHash: 'not-used-tests-sign-tokens-directly',
    homeInstitutionId,
    role,
    managedInstitutionIds: [],
    rite: 'orthodox',
  });
  const userId = user._id;
  return { userId, email, accessToken: signAccessToken(userId, role) };
}

export function createSuperAdmin(homeInstitutionId: string): Promise<TestUser> {
  return createUserDoc('superAdmin', homeInstitutionId, 'superadmin');
}

export function createUser(
  homeInstitutionId: string,
  emailPrefix = 'user',
): Promise<TestUser> {
  return createUserDoc('user', homeInstitutionId, emailPrefix);
}
