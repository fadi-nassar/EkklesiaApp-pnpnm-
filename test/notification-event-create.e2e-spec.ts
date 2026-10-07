import request from 'supertest';
import { API } from './setup/server-config.js';
import { dbFind } from './utils/db.js';
import {
  createInstitution,
  createSuperAdmin,
  createUser,
  TestUser,
} from './utils/fixtures.js';
import { authHeader } from './utils/auth.js';
import { uniqueSuffix } from './utils/random.js';

describe('Notification on event create (e2e)', () => {
  let institutionId: string;
  let admin: TestUser;
  let follower: TestUser;
  let nonFollower: TestUser;

  beforeAll(async () => {
    const institution = await createInstitution();
    institutionId = institution._id;
    admin = await createSuperAdmin(institutionId);

    follower = await createUser(institutionId, 'follower');
    nonFollower = await createUser(institutionId, 'nonfollower');

    const followRes = await request(API)
      .post(`/institutions/${institutionId}/follow`)
      .set(...authHeader(follower.accessToken));
    expect(followRes.status).toBe(201);
  });

  it('notifies followers, and only followers, when an event is created', async () => {
    const title = `Parish Picnic ${uniqueSuffix()}`;
    const eventRes = await request(API)
      .post(`/institutions/${institutionId}/events`)
      .set(...authHeader(admin.accessToken))
      .send({
        title,
        startsAt: new Date(Date.now() + 86400000).toISOString(),
      });
    expect(eventRes.status).toBe(201);
    const eventId = eventRes.body._id;

    const followerNotifications = await dbFind('Notification', {
      userId: follower.userId,
      type: 'event_created',
      refId: eventId,
    });
    expect(followerNotifications).toHaveLength(1);
    expect(followerNotifications[0].title).toContain(title);
    expect(followerNotifications[0].read).toBe(false);

    const nonFollowerNotifications = await dbFind('Notification', {
      userId: nonFollower.userId,
      type: 'event_created',
      refId: eventId,
    });
    expect(nonFollowerNotifications).toHaveLength(0);

    const listRes = await request(API)
      .get('/notifications')
      .set(...authHeader(follower.accessToken));
    expect(listRes.status).toBe(200);
    expect(
      listRes.body.items.some((n: any) => n.refId === eventId && n.type === 'event_created'),
    ).toBe(true);

    const unreadRes = await request(API)
      .get('/notifications/unread-count')
      .set(...authHeader(follower.accessToken));
    expect(unreadRes.status).toBe(200);
    expect(unreadRes.body.count).toBeGreaterThanOrEqual(1);

    const notificationId = followerNotifications[0]._id;
    const markReadRes = await request(API)
      .patch(`/notifications/${notificationId}/read`)
      .set(...authHeader(follower.accessToken));
    expect(markReadRes.status).toBe(200);
    expect(markReadRes.body.read).toBe(true);
  });
});
