import request from 'supertest';
import { API } from './setup/server-config.js';
import {
  createInstitution,
  createSuperAdmin,
  createUser,
  TestUser,
} from './utils/fixtures.js';
import { authHeader } from './utils/auth.js';

describe('Admin cancel (e2e)', () => {
  let institutionId: string;
  let admin: TestUser;
  let user: TestUser;

  beforeAll(async () => {
    const institution = await createInstitution();
    institutionId = institution._id;
    admin = await createSuperAdmin(institutionId);
    user = await createUser(institutionId, 'admincanceluser');
  });

  async function createRequestedBooking(offsetDays: number) {
    const startsAt = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    const res = await request(API)
      .post(`/institutions/${institutionId}/bookings`)
      .set(...authHeader(user.accessToken))
      .send({
        bookingType: 'engagement',
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        headcount: 5,
      });
    expect(res.status).toBe(201);
    return res.body._id as string;
  }

  it('lets an admin cancel another user\'s approved booking, but not twice', async () => {
    const bookingId = await createRequestedBooking(50);

    const approveRes = await request(API)
      .patch(`/institutions/${institutionId}/bookings/${bookingId}/approve`)
      .set(...authHeader(admin.accessToken));
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe('approved');

    const cancelRes = await request(API)
      .patch(`/institutions/${institutionId}/bookings/${bookingId}/cancel`)
      .set(...authHeader(admin.accessToken));
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe('cancelled');
    expect(cancelRes.body.userId).toBe(user.userId);

    const secondCancelRes = await request(API)
      .patch(`/institutions/${institutionId}/bookings/${bookingId}/cancel`)
      .set(...authHeader(admin.accessToken));
    expect(secondCancelRes.status).toBe(409);
    expect(secondCancelRes.body.message).toMatch(/cannot be cancelled/);
  });

  it('cannot admin-cancel a rejected booking', async () => {
    const bookingId = await createRequestedBooking(51);

    const rejectRes = await request(API)
      .patch(`/institutions/${institutionId}/bookings/${bookingId}/reject`)
      .set(...authHeader(admin.accessToken));
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.status).toBe('rejected');

    const cancelRes = await request(API)
      .patch(`/institutions/${institutionId}/bookings/${bookingId}/cancel`)
      .set(...authHeader(admin.accessToken));
    expect(cancelRes.status).toBe(409);
  });

  it('admin can cancel a still-requested (not yet approved) booking', async () => {
    const bookingId = await createRequestedBooking(52);

    const cancelRes = await request(API)
      .patch(`/institutions/${institutionId}/bookings/${bookingId}/cancel`)
      .set(...authHeader(admin.accessToken));
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe('cancelled');
  });

  it('404s admin-cancelling a booking id that does not exist', async () => {
    const res = await request(API)
      .patch(
        `/institutions/${institutionId}/bookings/507f1f77bcf86cd799439011/cancel`,
      )
      .set(...authHeader(admin.accessToken));
    expect(res.status).toBe(404);
  });

  it('rejects admin-cancel from a non-admin user', async () => {
    const bookingId = await createRequestedBooking(53);
    const res = await request(API)
      .patch(`/institutions/${institutionId}/bookings/${bookingId}/cancel`)
      .set(...authHeader(user.accessToken));
    expect(res.status).toBe(403);
  });
});
