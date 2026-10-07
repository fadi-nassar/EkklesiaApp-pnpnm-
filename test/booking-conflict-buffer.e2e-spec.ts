import request from 'supertest';
import { API } from './setup/server-config.js';
import {
  createInstitution,
  createSuperAdmin,
  createUser,
  TestUser,
} from './utils/fixtures.js';
import { authHeader } from './utils/auth.js';

describe('Booking conflict and buffer enforcement (e2e)', () => {
  let institutionId: string;
  let admin: TestUser;
  let user: TestUser;
  const BUFFER_MINUTES = 30;

  // a fixed future slot for booking A, far enough out not to collide with
  // any other test's bookings on the same (freshly created) institution
  const aStart = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
  const aEnd = new Date(aStart.getTime() + 2 * 60 * 60 * 1000);

  beforeAll(async () => {
    const institution = await createInstitution({
      bufferMinutes: BUFFER_MINUTES,
    });
    institutionId = institution._id;
    admin = await createSuperAdmin(institutionId);
    user = await createUser(institutionId, 'bookinguser');
  });

  async function createBooking(startsAt: Date, endsAt: Date) {
    return request(API)
      .post(`/institutions/${institutionId}/bookings`)
      .set(...authHeader(user.accessToken))
      .send({
        bookingType: 'baptism',
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        headcount: 10,
      });
  }

  function approveBooking(bookingId: string) {
    return request(API)
      .patch(`/institutions/${institutionId}/bookings/${bookingId}/approve`)
      .set(...authHeader(admin.accessToken));
  }

  it('lets two requested bookings for the same slot coexist', async () => {
    const resA = await createBooking(aStart, aEnd);
    expect(resA.status).toBe(201);
    expect(resA.body.status).toBe('requested');

    const resB = await createBooking(aStart, aEnd);
    expect(resB.status).toBe(201);
    expect(resB.body.status).toBe('requested');

    const bookingAId = resA.body._id;
    const bookingBId = resB.body._id;

    const approveA = await approveBooking(bookingAId);
    expect(approveA.status).toBe(200);
    expect(approveA.body.status).toBe('approved');

    // approving the second, still-overlapping request must now fail: A is
    // approved and occupies the slot
    const approveB = await approveBooking(bookingBId);
    expect(approveB.status).toBe(409);
    expect(approveB.body.message).toMatch(/conflicts with existing booking/);
  });

  it('rejects a new request inside the buffer window after an approved booking', async () => {
    const withinBufferStart = new Date(aEnd.getTime() + 15 * 60 * 1000); // +15min, buffer is 30min
    const withinBufferEnd = new Date(withinBufferStart.getTime() + 60 * 60 * 1000);

    const res = await createBooking(withinBufferStart, withinBufferEnd);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/conflicts with existing booking/);
  });

  it('allows a new request just outside the buffer window', async () => {
    const outsideBufferStart = new Date(aEnd.getTime() + 31 * 60 * 1000); // +31min, buffer is 30min
    const outsideBufferEnd = new Date(outsideBufferStart.getTime() + 60 * 60 * 1000);

    const createRes = await createBooking(outsideBufferStart, outsideBufferEnd);
    expect(createRes.status).toBe(201);

    const approveRes = await approveBooking(createRes.body._id);
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe('approved');
  });

  it('rejects headcount above capacity and a non-future start time', async () => {
    const overCapacity = await createBooking(
      new Date(Date.now() + 40 * 24 * 60 * 60 * 1000),
      new Date(Date.now() + 40 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
    );
    // sanity check the slot itself would be fine; now push headcount over the institution's maxAttendance (200)
    const res = await request(API)
      .post(`/institutions/${institutionId}/bookings`)
      .set(...authHeader(user.accessToken))
      .send({
        bookingType: 'baptism',
        startsAt: new Date(Date.now() + 41 * 24 * 60 * 60 * 1000).toISOString(),
        endsAt: new Date(Date.now() + 41 * 24 * 60 * 60 * 1000 + 3600000).toISOString(),
        headcount: 10000,
      });
    expect(overCapacity.status).toBe(201);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Headcount exceeds maximum attendance/);

    const pastRes = await createBooking(
      new Date(Date.now() - 60 * 60 * 1000),
      new Date(Date.now() + 60 * 60 * 1000),
    );
    expect(pastRes.status).toBe(400);
    expect(pastRes.body.message).toBe('Start time cannot be in the past');
  });
});
