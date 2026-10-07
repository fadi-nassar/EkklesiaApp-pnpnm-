import request from 'supertest';
import { API } from './setup/server-config.js';
import {
  createInstitution,
  createSuperAdmin,
  createUser,
  TestUser,
} from './utils/fixtures.js';
import { authHeader } from './utils/auth.js';
import { uniqueSuffix } from './utils/random.js';

describe('Salon deletion blocking (e2e)', () => {
  let institutionId: string;
  let admin: TestUser;
  let user: TestUser;

  beforeAll(async () => {
    const institution = await createInstitution();
    institutionId = institution._id;
    admin = await createSuperAdmin(institutionId);
    user = await createUser(institutionId, 'salonuser');
  });

  it('allows deleting a salon with no bookings', async () => {
    const createRes = await request(API)
      .post(`/institutions/${institutionId}/salons`)
      .set(...authHeader(admin.accessToken))
      .send({ name: `Empty Hall ${uniqueSuffix()}`, maxAttendance: 50 });
    expect(createRes.status).toBe(201);
    const salonId = createRes.body._id;

    const deleteRes = await request(API)
      .delete(`/institutions/${institutionId}/salons/${salonId}`)
      .set(...authHeader(admin.accessToken));
    expect(deleteRes.status).toBe(200);
  });

  it('blocks deleting a salon with a future approved booking, then allows it once that booking is gone', async () => {
    const createRes = await request(API)
      .post(`/institutions/${institutionId}/salons`)
      .set(...authHeader(admin.accessToken))
      .send({ name: `Busy Hall ${uniqueSuffix()}`, maxAttendance: 80 });
    expect(createRes.status).toBe(201);
    const salonId = createRes.body._id;

    const startsAt = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);

    const bookingRes = await request(API)
      .post(`/institutions/${institutionId}/bookings`)
      .set(...authHeader(user.accessToken))
      .send({
        bookingType: 'wedding',
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        headcount: 10,
        salonId,
      });
    expect(bookingRes.status).toBe(201);
    const bookingId = bookingRes.body._id;

    const approveRes = await request(API)
      .patch(`/institutions/${institutionId}/bookings/${bookingId}/approve`)
      .set(...authHeader(admin.accessToken));
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe('approved');

    const blockedDelete = await request(API)
      .delete(`/institutions/${institutionId}/salons/${salonId}`)
      .set(...authHeader(admin.accessToken));
    expect(blockedDelete.status).toBe(409);
    expect(blockedDelete.body.message).toMatch(/cannot be deleted/);

    const cancelRes = await request(API)
      .patch(`/institutions/${institutionId}/bookings/${bookingId}/cancel`)
      .set(...authHeader(admin.accessToken));
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe('cancelled');

    const allowedDelete = await request(API)
      .delete(`/institutions/${institutionId}/salons/${salonId}`)
      .set(...authHeader(admin.accessToken));
    expect(allowedDelete.status).toBe(200);
  });

  it('404s deleting a salon that does not exist', async () => {
    const res = await request(API)
      .delete(`/institutions/${institutionId}/salons/507f1f77bcf86cd799439011`)
      .set(...authHeader(admin.accessToken));
    expect(res.status).toBe(404);
  });
});
