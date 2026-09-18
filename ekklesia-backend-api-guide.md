# Ekklesia Backend — API Guide for Frontend

This doc tells you what's actually built and ready to use, how auth works, and exactly what each endpoint expects/returns. Everything here is live and tested against the running backend.

---

## 1. Getting the backend running on your machine

You need the backend running locally to develop against it.

```bash
git clone <backend-repo-url>
cd EkklesiaApp-pnpnm-
pnpm install
```

Copy `.env.example` to `.env` and fill in two real secrets:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```
Run that twice, paste one result into `JWT_ACCESS_SECRET`, the other into `JWT_REFRESH_SECRET`.

Start the database containers:
```bash
docker compose up -d
```
Wait ~15 seconds, then confirm both are healthy: `docker compose ps`.

Seed the database with test data (institutions + a superadmin + a test user):
```bash
pnpm run seed
```
This prints login credentials in the terminal — copy them, you'll need them.

Start the API:
```bash
pnpm run start:dev
```

**Base URL:** `http://localhost:3000/v1` (note the `/v1` prefix — every route below needs it)
**Interactive docs (Swagger):** `http://localhost:3000/docs` — try every endpoint live in the browser before wiring it into the app.
**Health check:** `GET http://localhost:3000/health` — confirms Mongo + Redis are actually connected.

---

## 2. How auth works (read this before building any screen)

Every protected endpoint needs an `Authorization: Bearer <accessToken>` header.

**The flow:**
1. `POST /v1/auth/register` or `POST /v1/auth/login` → returns `{ accessToken, refreshToken }`.
2. Store both. `accessToken` goes on every authenticated request. `refreshToken` gets stored securely on-device (this is what "remember me" is built on).
3. `accessToken` expires in **15 minutes**. When a request fails with `401`, call `POST /v1/auth/refresh-token` with the stored `refreshToken` to get a **new pair of both tokens** — the old refresh token is invalidated the moment you use it (rotation), so always save the new one.
4. `refreshToken` is valid for **30 days**, and that window extends every time it's used — so an active user is never logged out.
5. `deviceId` — generate a random UUID **once per device install**, store it locally, and send the same one on every register/login call. This is what lets the backend recognize "this device" for session management. It is not tied to hardware — a fresh app install means a fresh `deviceId`.

**Roles:** every user has a `role` — `user`, `churchAdmin`, or `superAdmin`. Regular signups always get `role: "user"` — there's no way to self-assign a higher role through the API, by design.

---

## 3. Endpoints available right now

### Auth (`/v1/auth`) — no token required to call these

| Method | Path | Body | Returns |
|---|---|---|---|
| POST | `/auth/register` | `{ username, email, password, homeInstitutionId, rite, deviceId }` | `{ accessToken, refreshToken }` — logs the user in immediately, same device |
| POST | `/auth/login` | `{ email, password, deviceId }` | `{ accessToken, refreshToken }` |
| POST | `/auth/refresh-token` | `{ refreshToken }` | `{ accessToken, refreshToken }` (both new) |
| POST | `/auth/logout` | `{ sessionId }` — **requires** `Authorization` header | `{}` on success |

**Notes for register:**
- `rite` currently only accepts `"orthodox"` — that's the only value in the system right now.
- `homeInstitutionId` must be a real institution's Mongo `_id` — fetch one from `GET /institutions` first (see below), you can't invent one.
- Registration failure on duplicate email returns a clear `409`: `"Email already registered, try logging in instead"`.

### Institutions (`/v1/institutions`)

| Method | Path | Auth | Body / Query | Returns |
|---|---|---|---|---|
| GET | `/institutions/:id` | none | — | One institution. **Never includes `admins`.** |
| GET | `/institutions` | none | optional query: `?name=` (partial, case-insensitive), `?type=church\|monastery`, `?rite=orthodox` — combinable | Array of institutions. **Never includes `admins`.** |
| POST | `/institutions` | superAdmin only | `{ name, type, town, rite }` | The created institution |
| PATCH | `/institutions/:id/admins` | superAdmin only | `{ userId }` | The updated institution, with the new admin added |

**Notes:**
- `POST /institutions` only takes `name`, `type`, `town`, `rite` — everything else (`currency`, `timezone`, exact `location`) gets sensible defaults. `town` must currently be one of the towns in the backend's known-towns list (currently just `"Kousba"` — ask before assuming a town works, more will be added).
- An institution starts with **zero admins**. `PATCH .../admins` is how a superAdmin assigns a `churchAdmin` — this also updates that user's own `role` to `churchAdmin` automatically. Max 5 admins per institution.
- `admins` is deliberately hidden from every public-facing response — don't expect it in any `GET`.

---

## 4. What's NOT built yet — don't design UI around these expecting them to exist

- Schedules, Events, News (prayer timetables, parish posts) — next on the backend roadmap
- Follow/unfollow, the following feed, discovery recommendations
- Notifications
- Books/library, the per-parish store, ceremony bookings (weddings/baptisms/engagements)
- Any payment flow

If your screen needs any of the above, hold off or build with mock data — the real endpoints don't exist server-side yet, so nothing will actually connect.

---

## 5. Test credentials (from the seed script)

Run `pnpm run seed` yourself to get fresh, real values printed in your terminal — the script prints a superadmin login and a regular test-user login you can use immediately in Swagger or in your app during development.

---

## 6. If something breaks or looks wrong

Check `GET /health` first — if Mongo or Redis show `"down"`, nothing else will work regardless of what you're building. Otherwise, ping the backend owner directly rather than guessing — this doc reflects what's live as of today, but the API will keep growing.
