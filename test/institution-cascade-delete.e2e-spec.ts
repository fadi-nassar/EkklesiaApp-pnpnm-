import request from 'supertest';
import { API } from './setup/server-config.js';
import { dbInsert, dbFindById, dbCount } from './utils/db.js';
import { createInstitution, createSuperAdmin } from './utils/fixtures.js';
import { authHeader } from './utils/auth.js';
import { uniqueEmail, uniqueSuffix } from './utils/random.js';

describe('Institution delete cascade (e2e)', () => {
  it('removes the institution and every related record, and demotes its churchAdmin', async () => {
    const institution = await createInstitution();
    const institutionId = institution._id;
    const superAdmin = await createSuperAdmin(institutionId);

    // a plain user who will be promoted to churchAdmin of this institution
    const churchAdmin = await dbInsert('User', {
      username: `churchadmin-${uniqueSuffix()}`,
      email: uniqueEmail('churchadmin'),
      passwordHash: 'not-used-tests-sign-tokens-directly',
      homeInstitutionId: institutionId,
      role: 'user',
      managedInstitutionIds: [],
      rite: 'orthodox',
    });

    const assignRes = await request(API)
      .patch(`/institutions/${institutionId}/admins`)
      .set(...authHeader(superAdmin.accessToken))
      .send({ userId: churchAdmin._id });
    expect(assignRes.status).toBe(200);

    const otherUser = await dbInsert('User', {
      username: `other-${uniqueSuffix()}`,
      email: uniqueEmail('other'),
      passwordHash: 'not-used-tests-sign-tokens-directly',
      homeInstitutionId: institutionId,
      role: 'user',
      managedInstitutionIds: [],
      rite: 'orthodox',
    });

    await Promise.all([
      dbInsert('Event', {
        institutionId,
        title: 'Cascade test event',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
      }),
      dbInsert('News', {
        institutionId,
        title: 'Cascade test news',
        body: 'body',
        publishedAt: new Date().toISOString(),
      }),
      dbInsert('Follow', { userId: otherUser._id, institutionId }),
      dbInsert('Schedule', {
        institutionId,
        dayOfWeek: 0,
        time: '09:00',
        serviceType: 'mass',
      }),
      dbInsert('ScheduleException', {
        institutionId,
        date: new Date(Date.now() + 86400000).toISOString(),
        action: 'cancel',
      }),
      dbInsert('Booking', {
        userId: otherUser._id,
        institutionId,
        bookingType: 'baptism',
        startsAt: new Date(Date.now() + 86400000).toISOString(),
        endsAt: new Date(Date.now() + 90000000).toISOString(),
        headcount: 5,
        status: 'requested',
      }),
    ]);

    const deleteRes = await request(API)
      .delete(`/institutions/${institutionId}`)
      .set(...authHeader(superAdmin.accessToken));
    expect(deleteRes.status).toBe(200);

    const remainingInstitution = await dbFindById('Institution', institutionId);
    expect(remainingInstitution).toBeNull();

    const [eventCount, newsCount, followCount, scheduleCount, exceptionCount, bookingCount] =
      await Promise.all([
        dbCount('Event', { institutionId }),
        dbCount('News', { institutionId }),
        dbCount('Follow', { institutionId }),
        dbCount('Schedule', { institutionId }),
        dbCount('ScheduleException', { institutionId }),
        dbCount('Booking', { institutionId }),
      ]);
    expect(eventCount).toBe(0);
    expect(newsCount).toBe(0);
    expect(followCount).toBe(0);
    expect(scheduleCount).toBe(0);
    expect(exceptionCount).toBe(0);
    expect(bookingCount).toBe(0);

    const demotedAdmin = await dbFindById('User', churchAdmin._id);
    expect(demotedAdmin?.role).toBe('user');
    expect(
      demotedAdmin?.managedInstitutionIds.some((id: string) => id === institutionId),
    ).toBe(false);
  });

  it('404s deleting an institution that does not exist', async () => {
    const institution = await createInstitution();
    const superAdmin = await createSuperAdmin(institution._id);

    const res = await request(API)
      .delete('/institutions/507f1f77bcf86cd799439011')
      .set(...authHeader(superAdmin.accessToken));
    expect(res.status).toBe(404);
  });
});
