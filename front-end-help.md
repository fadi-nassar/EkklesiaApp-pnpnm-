# Ekklesia — Front-End Help

Everything a front-end developer needs to build an app on top of the Ekklesia backend: how it is wired, every endpoint, every field and rule, how the pieces depend on each other, and the traps to avoid.

> This document was written by reading the backend source code (controllers, DTOs, guards, services, schemas, jobs) on 2026-10-10. It describes what the code **does**, not what it was meant to do. Where behaviour is surprising it is flagged with ⚠️.

---

## Table of contents

1. [Quick start (read this first)](#1-quick-start-read-this-first)
2. [What the backend is — and what it is NOT](#2-what-the-backend-is--and-what-it-is-not)
3. [Running the backend locally](#3-running-the-backend-locally)
4. [Global conventions](#4-global-conventions)
5. [Roles and permissions](#5-roles-and-permissions)
6. [Authentication flow](#6-authentication-flow)
7. [Data model and how everything is linked](#7-data-model-and-how-everything-is-linked)
8. [TypeScript types (copy/paste)](#8-typescript-types-copypaste)
9. [Endpoint reference](#9-endpoint-reference)
   - 9.1 Health · 9.2 Auth · 9.3 Profile · 9.4 Institutions · 9.5 Nearby search · 9.6 Salons · 9.7 Follows · 9.8 Home feed · 9.9 Schedules · 9.10 Schedule exceptions · 9.11 Events · 9.12 News · 9.13 Bookings · 9.14 Books · 9.15 Quotes · 9.16 Notifications
10. [Business logic deep dives](#10-business-logic-deep-dives)
11. [Screen-by-screen guide (which endpoints each screen needs)](#11-screen-by-screen-guide)
12. [Gotchas checklist](#12-gotchas-checklist)
13. [Missing from the backend (ask the backend owner)](#13-missing-from-the-backend-ask-the-backend-owner)
14. [Full endpoint index](#14-full-endpoint-index)

---

## 1. Quick start (read this first)

- **Base URL:** `http://localhost:3000/v1` when running locally. **Every route needs the `/v1` prefix**, except `GET /health` (no prefix). Ask the backend owner for the deployed URL.
- **Auth:** `Authorization: Bearer <accessToken>`. Access tokens are short-lived (e.g. 15 min); refresh tokens are long-lived (e.g. 30 days) and **rotate on every use**.
- **JSON everywhere.** `Content-Type: application/json` on every request with a body.
- **Ids** are 24-character hex strings (MongoDB ObjectIds), always called `_id` in responses (the one exception is `GET /users/me`, which uses `id`).
- **Dates** are ISO-8601 strings. Always send them with a timezone, preferably UTC with `Z`: `"2027-06-12T14:00:00Z"`.
- **Request bodies are strict.** Any field not listed for an endpoint makes the request fail with `400 "property X should not exist"`. The same applies to query strings on endpoints that have a query DTO (see §4.4).
- **Three roles:** `user`, `churchAdmin` (manages specific institutions), `superAdmin` (everything).
- **Errors** always look like `{ statusCode, timestamp, path, message }` where `message` is a string **or an array of strings**.
- **Swagger** (try endpoints in the browser): `http://localhost:3000/docs` — only when the server is not in production mode. ⚠️ It lists routes but has **no request/response schemas** (the DTOs aren't annotated), so use this document for shapes.
- **Dev accounts** (only exist if the dev database was seeded with `pnpm run seed`):
  | Role | Email | Password |
  |---|---|---|
  | superAdmin | `superadmin@ekklesia.dev` | `SuperAdmin123!` |
  | user | `testuser@ekklesia.dev` | `TestUser123!` |

  These are local-dev seed credentials. Never use them (or assume they exist) on a shared/production server.

---

## 2. What the backend is — and what it is NOT

**Stack:** NestJS 12 (Express), MongoDB (Mongoose, replica set because it uses transactions), Redis (rate limiting + BullMQ job queue), JWT (HS256) access tokens, opaque random refresh tokens stored hashed in Mongo.

**It is a REST/JSON API for an Orthodox parish app:**
- People find churches/monasteries (by name, type, or GPS "nearby"), follow them, see their weekly service times, special changes, events and news.
- People request ceremonies (wedding, baptism, engagement) at an institution; the institution's admins approve/reject them. Admins can also record funerals directly.
- Institutions have optional rooms ("salons") that can be booked instead of the main sanctuary.
- A global library of prayer books (links to files), and a "verse of the day".
- In-app notifications (a list the app reads; **not** push notifications).

**It does NOT have (don't build UI that expects these):**

| Missing | Consequence for the front end |
|---|---|
| File/image upload | Every image/file field (`coverImage`, `image`, `coverUrl`, `fileUrl`) is just a **URL string**. Host files elsewhere and paste the URL. |
| Push notifications (FCM/APNs) | Notifications are rows in the database. The app must **poll** `GET /notifications/unread-count` (or list) itself. |
| Email / password reset / email verification / OTP | No "forgot password" flow exists. (`RESEND_API_KEY` and `OTP_TTL` exist in the env file but nothing uses them.) |
| Likes | `likeCount` exists on events and news but is always `0`; there is no like endpoint. |
| Payments / store | `currency` exists on institutions (`USD`) but nothing uses it. |
| User search / listing | No endpoint finds a user by name/email. See §13 — this affects "assign admin" and "who booked". |
| Remove an admin / list admins | You can assign admins but never list or remove them (except by deleting the institution). |
| Real-time (websockets) | Poll when you need freshness. |
| Pagination on most lists | Only `GET /events` and `GET /notifications` are paginated. All other lists return the full array. |

---

## 3. Running the backend locally

Easiest option: ask the backend owner to run it/host it and give you the base URL. If you want to run it yourself:

```bash
pnpm install
cp .env.example .env          # then fill in the values below
docker compose up -d          # MongoDB (replica set rs0) + Redis
pnpm run seed                 # 2 institutions + 2 users (see §1)
pnpm run start:dev            # API on http://localhost:3000
```

`.env` values that matter to a front-end dev:

| Variable | Meaning |
|---|---|
| `APP_ENV` | `development` → CORS open to every origin and Swagger enabled. `production` → CORS restricted and Swagger disabled. |
| `PORT` | Default `3000`. |
| `CORS_ORIGINS` | Comma-separated allowed origins when **not** in development. Browser apps served from an origin not in this list get blocked by CORS (native mobile apps are not affected by CORS). |
| `ACCESS_TTL` | Access-token lifetime (e.g. `15m`). Don't hard-code it in the app: decode the JWT's `exp` claim instead. |
| `REFRESH_TTL` | Refresh-token lifetime (e.g. `30d`); resets every time the token is used. |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | ≥32 chars each. Backend-only. |
| `MONGO_URI`, `REDIS_URL` | Backend-only. |

⚠️ `docker-compose.yml` starts Mongo with `--keyFile /data/db/keyfile`, and that keyfile is not in the repository. If the Mongo container exits immediately on a fresh machine, that's why — ask the backend owner for their setup or just use their running instance.

Health check (no auth, **no `/v1`**): `GET /health` → `{ "status": "ok"|"error", "mongo": "up"|"down", "redis": "up"|"down", "timestamp": "…" }`.

---

## 4. Global conventions

### 4.1 URL, versioning, headers
- Version is in the URL: `/v1/...`. `GET /health` is version-neutral (`/health`).
- Responses are gzip/brotli compressed when the client accepts it (every normal HTTP client does this automatically) and carry Helmet security headers.
- JSON request bodies larger than ~100 KB are rejected with `413`.
- Unknown routes → `404` with message like `"Cannot GET /v1/whatever"`.

### 4.2 Ids
24 hex characters, e.g. `"507f1f77bcf86cd799439011"`. Almost every route parameter named like an id is validated first; anything else gives `400 {"message":"Invalid id"}`. Body fields that hold ids (`homeInstitutionId`, `salonId`, `userId`, `sessionId`, `institutionId` in event search) are validated the same way (`400` with a message such as `"salonId must be a mongodb id"`).

### 4.3 Dates and time zones
- Send ISO-8601. Prefer UTC with `Z` (`2027-06-12T14:00:00Z`) or an explicit offset (`+03:00`). A date-only string (`2027-06-12`) or a string with no offset is accepted by validation, but how it's interpreted depends on the server's time zone — don't rely on it.
- Responses always return UTC ISO strings (`2027-06-12T14:00:00.000Z`).
- Every institution has a `timezone` (currently always `"Asia/Beirut"`). **Display event/booking times in the institution's time zone** (use `Intl.DateTimeFormat`/luxon/date-fns-tz with `institution.timezone`), not blindly the phone's.
- Weekly schedule times (`time: "09:30"`) are plain wall-clock strings with no zone: they mean "09:30 at the institution".
- ⚠️ The **home feed** and schedule-exception matching compute "next occurrence" using the **server's** time zone, not the institution's (see §10.2). Confirm the server runs in `Asia/Beirut` (or `TZ=Asia/Beirut`), otherwise home-feed times can be off by hours.

### 4.4 Strict request validation
The server runs a global validation pipe with `whitelist` + `forbidNonWhitelisted` + `transform`:
- **Body:** any property not declared for that endpoint ⇒ `400` with `"property <name> should not exist"`. Missing/invalid properties ⇒ `400` with an **array** of messages.
- **Query string:** endpoints that have a query DTO behave the same way: unknown keys are rejected with `400`. These are: `GET /institutions`, `GET /institutions/nearby`, `GET /events`, `GET /books`, `GET /notifications`, `GET /institutions/:id/bookings`. ⚠️ **Don't add extra query params** (cache busters, tracking, etc.) to those.
- Query strings on **per-institution events / news / schedule-exceptions lists** (`from`, `to`) are *not* validated: unknown keys are ignored, and an unparseable date will usually produce a `500` rather than a clean `400`. Validate dates on the client.
- Numbers in query strings (`page`, `limit`, `lat`, `lng`, `maxDistance`) are converted from strings automatically.
- **Don't send `null` for fields.** Omit fields you don't want to change. (`null` passes the "optional" validators; on optional fields it may clear the value, on required fields it can cause a `500`.)
- Empty string `""` is **not** "unset": URL fields reject it with `400`.
- URL fields use strict URL validation: must include a scheme (`https://…`) and a real top-level domain. `http://localhost:9000/x.png` is **rejected**; use a proper domain.

### 4.5 Error format
```json
{
  "statusCode": 400,
  "timestamp": "2026-10-05T11:47:58.123Z",
  "path": "/v1/institutions/abc/bookings",
  "message": "Invalid id"
}
```
`message` is a **string** for most errors and an **array of strings** for body/query validation errors (e.g. `["headcount must not be less than 1"]`). Write one helper that normalises both (`Array.isArray(m) ? m.join('\n') : m`).

| Code | Meaning in this API |
|---|---|
| 400 | Validation failed, bad id, or a business rule (e.g. booking in the past, wrong current password). |
| 401 | Missing/invalid/expired **access token** — body `"Unauthorized"` — **but also** several business errors (bad login, bad refresh token, wrong password on account deletion). See §6.4. |
| 403 | Logged in but not allowed (not an admin of that institution, not superAdmin, superAdmin deleting self). |
| 404 | Not found (also: "that booking exists but isn't yours"). |
| 409 | Conflict (duplicate email/follow/schedule/salon name/exception; booking slot taken; salon has bookings; sole admin). |
| 413 | Body too large. |
| 429 | Rate limited. Read the `Retry-After` header (seconds). |
| 500 | Unexpected; body is `"Internal server error"`. |

### 4.6 Rate limits
Per client IP **and per endpoint** (each route has its own counter):
- Default: **100 requests / minute**.
- `POST /auth/login`: 10/min · `POST /auth/register`: 5/min · `POST /auth/refresh-token`: 20/min · `POST /auth/logout`: 20/min · `POST /auth/change-password`: 5/min.
- Over the limit → `429`. Back off using `Retry-After`.

### 4.7 Response quirks
- **POST returns `201`, PATCH/GET/DELETE return `200`** (except `DELETE /users/me` → `204`).
- **Some responses have an empty body** (no JSON): `POST /auth/logout` (201), `DELETE /institutions/:id` (200), `DELETE /institutions/:id/salons/:salonId` (200), `DELETE /users/me` (204). Don't call `response.json()` on them blindly.
- Documents straight from MongoDB include **`__v`** (a version counter) — ignore it. Optional fields that were never set are simply **absent** (not `null`).
- `ObjectId` values appear as plain strings.
- `DELETE /users/me` requires a **JSON body** (`{ "password": "…" }`). Some HTTP clients drop bodies on DELETE by default (axios needs `data:`; fetch is fine).

### 4.8 Pagination
Only two endpoints paginate, both with `?page=1&limit=20` (`page ≥ 1`, `limit` 1–50, defaults 1 and 20) and the same envelope:
```json
{ "items": [ … ], "page": 1, "limit": 20, "total": 134 }
```
`total` is the count of **all** matches ignoring paging. Everything else returns a bare array of everything.

---

## 5. Roles and permissions

Roles live on the user (`role`) and inside the access token.

| Role | How you get it | Can do |
|---|---|---|
| `user` | Register always creates this. | Everything "logged-in" below: profile, follow, book, cancel own booking, notifications. |
| `churchAdmin` | A superAdmin assigns the user to an institution (`PATCH /institutions/:id/admins`). | Everything a user can, **plus** manage the institutions in their `managedInstitutionIds`: edit info, salons, events, news, schedules, exceptions; list/approve/reject/cancel bookings; create funerals. |
| `superAdmin` | Cannot be created through the API (seed/DB only). | Everything, on **every** institution, plus: create/delete institutions, assign admins, manage the books library. |

Guards used below:

| Label | Meaning | Failure responses |
|---|---|---|
| **public** | No token needed. | — |
| **logged-in** | Any valid access token. | `401 "Unauthorized"` |
| **institution admin** | `superAdmin`, **or** `churchAdmin` listed in that institution's `admins`. The institution is taken from `:institutionId` in the URL. | `401`; plain `user` ⇒ `403 "Forbidden resource"`; churchAdmin of a different institution ⇒ `403 "Forbidden resource"`; churchAdmin + institution doesn't exist ⇒ `403 "Institution not found."`; churchAdmin + malformed id ⇒ `400 "Invalid id"`. |
| **superAdmin** | `role == "superAdmin"` only. | `401`; others ⇒ `403 "Access denied. Super admin privileges required."` |

⚠️ **The role in the access token is frozen until it is refreshed.** Authorization uses the role inside the JWT, not the database. If someone has just been made `churchAdmin`, their *current* access token still says `user` and admin routes return `403` until they call `POST /auth/refresh-token` (or log in again), which issues a token with the new role. Likewise `GET /users/me` always reflects the **database** (current role + `managedInstitutionIds`), so after a role change: refresh the token, then re-fetch `/users/me`.

⚠️ Deleting an institution demotes any churchAdmin whose last managed institution it was back to `user` in the database; their token keeps saying `churchAdmin` until the next refresh.

---

## 6. Authentication flow

### 6.1 Tokens
- **Access token**: JWT (HS256). Payload: `{ sub: <userId>, role, iat, exp }`. Send as `Authorization: Bearer …`. Not looked up in the database on each request.
- **Refresh token**: random 64-hex-char string (not a JWT), stored hashed on the server. One per (user, device).
- **sessionId**: the id of that server-side session; needed for logout.
- **deviceId**: *you* generate a random UUID once per app install and persist it. Send the same value on every register/login.

### 6.2 The lifecycle
1. **Register** or **Login** → `{ accessToken, refreshToken, sessionId }`. Store all three securely (Keychain/Keystore/secure storage; never `localStorage` for a native-style app if avoidable).
2. Call the API with the access token.
3. When a request returns `401 "Unauthorized"`, call **refresh-token** with the stored refresh token → `{ accessToken, refreshToken }` (**both new**). Save both. The old refresh token is now dead (`401 "Invalid refresh token"` if reused). Retry the original request **once**.
4. **Refresh does not return `sessionId`** — keep the one from login/register.
5. If refresh fails (any 401) → clear storage → show login.
6. **Logout**: `POST /auth/logout { sessionId }` then discard tokens locally. The already-issued access token remains valid until it expires; the server can't revoke it.
7. Logging in again on the **same deviceId** deletes that device's previous session (its old refresh token stops working).
8. The refresh window is sliding: each refresh pushes the expiry out by `REFRESH_TTL`. A session idle for the whole TTL is deleted automatically and refresh returns `401 "Invalid refresh token"`.
9. **Change password** revokes **all** the user's sessions on **all** devices. Their current access token still works until it expires, but any refresh will fail. After success: clear local tokens and send the user to login.
10. **Delete account** also removes all sessions. Clear local tokens on `204`.

### 6.3 Reference implementation (framework-agnostic TypeScript)

```ts
const BASE = 'http://localhost:3000/v1';
let refreshInFlight: Promise<boolean> | null = null;   // single-flight: refresh tokens rotate!

async function refreshTokens(): Promise<boolean> {
  const refreshToken = await storage.get('refreshToken');
  if (!refreshToken) return false;
  const res = await fetch(`${BASE}/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;
  const data = await res.json();                       // { accessToken, refreshToken }
  await storage.set('accessToken', data.accessToken);
  await storage.set('refreshToken', data.refreshToken); // MUST save the new one
  return true;
}

export async function api(path: string, init: RequestInit = {}, opts = { auth: true }) {
  const send = async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(init.headers as any) };
    if (opts.auth) headers.Authorization = `Bearer ${await storage.get('accessToken')}`;
    return fetch(`${BASE}${path}`, { ...init, headers });
  };

  let res = await send();

  // Only the JWT guard answers with the exact message "Unauthorized".
  // Other 401s ("Invalid credentials", "Incorrect password.", …) are business errors: do NOT refresh on them.
  if (res.status === 401 && opts.auth) {
    const body = await res.clone().json().catch(() => null);
    if (body?.message === 'Unauthorized') {
      refreshInFlight ??= refreshTokens().finally(() => (refreshInFlight = null));
      if (await refreshInFlight) res = await send();            // retry once
      else { await logoutLocally(); }                           // go to login screen
    }
  }
  return res;
}
```

Why single-flight matters: if two requests 401 at once and both call refresh with the same refresh token, the second call fails (`Invalid refresh token`) because the first already rotated it — and your app would wrongly log the user out.

### 6.4 ⚠️ 401s that are NOT "token expired"
A naive "401 → refresh" interceptor will misbehave on these:

| Endpoint | 401 message | Real meaning |
|---|---|---|
| `POST /auth/login` | `"Invalid credentials"` | wrong email/password |
| `POST /auth/refresh-token` | `"Invalid refresh token"`, `"Refresh token expired"`, `"User not found"` | refresh failed → must log in again |
| `DELETE /users/me` | `"Incorrect password."` | wrong password in the confirm dialog |
| `POST /auth/change-password` | `"User not found"` (rare) | account no longer exists |

(For comparison, a wrong *current* password on change-password is deliberately a **400**, specifically so it doesn't trigger a refresh/logout loop.) Only treat `401` as "refresh now" when `message === "Unauthorized"`.

---

## 7. Data model and how everything is linked

### 7.1 The entities

| Entity | Belongs to | Notes |
|---|---|---|
| **User** | `homeInstitutionId` → Institution; `managedInstitutionIds[]` → Institutions | Email is stored lowercased and is unique. Password hash is never returned. |
| **Session** | User | One per (user, device). Created at login/register; deleted at logout/password change/account delete; auto-expires. |
| **Institution** | — | A church or monastery. Holds `admins[]` (User ids), embedded `salons[]`, GPS `location`, capacity, buffer, contact links, `followerCount`. |
| **Salon** | embedded in Institution | A bookable room. Has its own `_id`, `name`, `maxAttendance`. |
| **Schedule** | Institution | Weekly recurring service (dayOfWeek + time + serviceType). Unique per (institution, dayOfWeek, time). |
| **ScheduleException** | Institution | One-day change to the schedule: `cancel` / `override` (new time) / `special` (extra service). |
| **Event** | Institution | One-off event. |
| **News** | Institution | News/announcement post. |
| **Follow** | User + Institution | Unique per pair. |
| **Booking** | User + Institution (+ optional salon) | Ceremony request: wedding/baptism/engagement; admins also create funerals. |
| **Notification** | User | `refId` points at an Event or a Booking depending on `type`. |
| **Book** | — (global) | Library entry. Not tied to any institution. |
| **Verse** | — (static file) | 365 Arabic verses (Van Dyck) in a JSON file; not in the database. |

### 7.2 Relationship map

```
                         ┌────────────────────────── Institution ──────────────────────────┐
                         │ admins[] ◀──────────┐   salons[] (embedded)   followerCount      │
                         └─▲──────▲──────▲──────┼──────▲───────────────────▲────────────────┘
                           │      │      │      │      │                   │
  User ──homeInstitutionId─┘      │      │      │      │                   │
   │  └─managedInstitutionIds[] ◀─┼──────┼──────┘      │ (kept in sync by PATCH /institutions/:id/admins)
   │                              │      │             │
   ├──< Session (1 per deviceId)  │      │             │
   ├──< Follow >──────────────────┘      │             │
   ├──< Booking >─── institutionId ──────┘             │
   │        └── salonId (optional) ──────────────── salons[]._id
   └──< Notification ── refId ──▶ Event (event_created, event_reminder)
                              └─▶ Booking (booking_status, booking_reminder)

  Institution ──< Event · News · Schedule · ScheduleException · Booking · Follow
```

### 7.3 What happens when things change (cascades & side effects)

| Action | Side effects |
|---|---|
| **Follow** an institution | Creates a Follow, `followerCount += 1`. |
| **Unfollow** | Deletes the Follow, `followerCount -= 1`. |
| **Create event** | Every follower gets a notification `event_created` (best effort; failures never fail the request). |
| **Edit/delete event** | No notifications. |
| **Approve / reject / admin-cancel a booking** | The booking's owner gets a `booking_status` notification. |
| **Owner cancels own booking** | No notification. |
| **Assign admin** (`PATCH /institutions/:id/admins`) | Transaction: adds the user to `institution.admins`, adds the institution to the user's `managedInstitutionIds`, sets the user's `role = churchAdmin`. Max 5 admins per institution. |
| **Delete institution** | Transaction: deletes the institution **and** all its events, news, bookings, follows, schedules, schedule exceptions; removes it from each admin's `managedInstitutionIds`; any admin left with none is set back to `role: user`. |
| **Delete salon** | Blocked (`409`) if a `requested`/`approved` booking for it ends in the future. Past bookings referencing it are left as they are (their `salonId` then points at nothing — be ready for a salon that can't be found). |
| **Change password** | Deletes all the user's sessions. |
| **Delete account** (`DELETE /users/me`) | Transaction: deletes the user's follows (decrementing counts), **future** bookings (past ones are kept), all notifications, all sessions; removes them from any institution `admins`; deletes the user. Blocked if they are the *sole* admin of any institution (`409`) or a superAdmin (`403`). |
| **Daily job** (18:00 Asia/Beirut) | Creates `event_reminder` for followers of every event starting the next Beirut calendar day, and `booking_reminder` for the owner of every `approved` booking starting the next day (once each). |
| **Time passing** | Notifications older than 60 days are deleted automatically. Expired sessions are deleted automatically. |

### 7.4 "To show X you must call Y" (the joins the server does NOT do for you)

- A **booking** has only `institutionId` and `salonId`. To show the institution name call `GET /institutions/:id` (cache it). To show the salon name look up `salonId` in that institution's `salons[]`.
- A **notification** has only `type` + `refId`. For `event_*` call `GET /events/:refId`. For `booking_*` there is **no** "get one booking" endpoint — find it in `GET /users/me/bookings`.
- A **follow list** (`GET /users/me/follows`) returns full institution objects (no extra call).
- A **global event search** (`GET /events`) returns each event's `institutionId` already expanded to `{ _id, name }`. Every other event endpoint returns `institutionId` as a plain id string.
- An admin's **booking list** has `userId` only — **no names or emails**. The API gives no way to look up another user (see §13).
- The **home feed** items have only `label` and `occursAt` — no ids, no item type.

---

## 8. TypeScript types (copy/paste)

```ts
type ObjectIdString = string;   // 24 hex chars
type ISODate = string;          // e.g. "2027-06-12T14:00:00.000Z"

type Role = 'user' | 'churchAdmin' | 'superAdmin';
type Rite = 'orthodox';                              // only value today
type InstitutionType = 'church' | 'monastery';
type ServiceType = 'mass' | 'regular_prayer';
type BookingType = 'wedding' | 'baptism' | 'engagement' | 'funeral';
type BookingStatus = 'requested' | 'approved' | 'rejected' | 'cancelled';
type ExceptionAction = 'cancel' | 'override' | 'special';
type NotificationType = 'event_created' | 'event_reminder' | 'booking_reminder' | 'booking_status';

interface ApiError {
  statusCode: number;
  timestamp: ISODate;
  path: string;
  message: string | string[];
}

interface AuthTokens { accessToken: string; refreshToken: string; sessionId: ObjectIdString }
interface RefreshedTokens { accessToken: string; refreshToken: string }   // no sessionId!

interface Profile {                       // GET/PATCH /users/me   (NOTE: "id", not "_id")
  id: ObjectIdString;
  username: string;
  email: string;
  role: Role;
  rite: Rite;
  homeInstitutionId: ObjectIdString;
  managedInstitutionIds: ObjectIdString[];   // [] for plain users and superAdmins
}

interface Salon { _id: ObjectIdString; name: string; maxAttendance: number }

interface Institution {
  _id: ObjectIdString;
  name: string;
  description?: string;
  type: InstitutionType;
  rite: Rite;
  country: string;                 // e.g. "Lebanon"
  currency: string;                // "USD" (unused)
  timezone: string;                // "Asia/Beirut"
  location: { type: 'Point'; coordinates: [lng: number, lat: number] };   // ⚠️ [longitude, latitude]
  maxAttendance: number;           // capacity of the main sanctuary
  bufferMinutes: number;           // required gap between approved bookings (default 30)
  salons: Salon[];                 // may be []
  phone?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  mapsUrl?: string;
  coverImage?: string;
  followerCount: number;
  createdAt: ISODate;
  updatedAt: ISODate;
  // `admins` is deliberately NOT included — except in the response of PATCH /institutions/:id/admins
}

interface Follow { _id: ObjectIdString; userId: ObjectIdString; institutionId: ObjectIdString; createdAt: ISODate; updatedAt: ISODate }

interface Schedule {
  _id: ObjectIdString;
  institutionId: ObjectIdString;
  dayOfWeek: number;               // 0=Sunday … 6=Saturday
  time: string;                    // "HH:mm" 24h, institution wall-clock
  serviceType: ServiceType;
  createdAt: ISODate; updatedAt: ISODate;
}

interface ScheduleException {
  _id: ObjectIdString;
  institutionId: ObjectIdString;
  date: ISODate;
  action: ExceptionAction;
  time?: string;                   // "HH:mm"; present for override/special
  serviceType?: ServiceType;       // present for special
  createdAt: ISODate; updatedAt: ISODate;
}

interface EventItem {
  _id: ObjectIdString;
  institutionId: ObjectIdString;           // in GET /events items: { _id, name } instead
  title: string;
  description?: string;
  image?: string;
  startsAt: ISODate;
  endsAt?: ISODate;
  likeCount: number;                       // always 0
  createdAt: ISODate; updatedAt: ISODate;
}

interface NewsItem {
  _id: ObjectIdString;
  institutionId: ObjectIdString;
  title: string;
  body: string;
  image?: string;
  publishedAt: ISODate;
  likeCount: number;                       // always 0
  createdAt: ISODate; updatedAt: ISODate;
}

interface Booking {
  _id: ObjectIdString;
  userId: ObjectIdString;                  // for funerals: the admin who created it
  institutionId: ObjectIdString;
  bookingType: BookingType;
  salonId?: ObjectIdString;                // absent ⇒ main sanctuary
  startsAt: ISODate;
  endsAt: ISODate;
  headcount: number;
  status: BookingStatus;
  notes?: string;
  createdAt: ISODate; updatedAt: ISODate;
}

interface HomeFeedItem { label: string; occursAt: ISODate }   // label = "mass" | "regular_prayer" | event title

interface Book {
  _id: ObjectIdString;
  title: string;
  author?: string;
  prayerType?: string;
  description?: string;
  language: string;                        // default "ar"
  fileUrl: string;
  coverUrl?: string;
  createdAt: ISODate; updatedAt: ISODate;
}

interface Verse { book: string; chapter: number; verse: number; text: string }   // Arabic, with diacritics

interface AppNotification {
  _id: ObjectIdString;
  userId: ObjectIdString;
  type: NotificationType;
  title: string;                           // English text generated by the server
  body: string;                            // English text generated by the server
  refId?: ObjectIdString;                  // Event id or Booking id depending on type
  read: boolean;
  createdAt: ISODate;                      // (no updatedAt)
}

interface Page<T> { items: T[]; page: number; limit: number; total: number }
```

---

## 9. Endpoint reference

Legend: **public** / **logged-in** / **institution admin** / **superAdmin** — see §5. All paths are relative to `/v1`. "Body" lists accepted fields; **anything else is rejected**.

### 9.1 Health

| Method | Path | Auth | Response |
|---|---|---|---|
| GET | `/health` (no `/v1`) | public | `{ status: "ok"\|"error", mongo: "up"\|"down", redis: "up"\|"down", timestamp }` — HTTP status is `200` either way, check the `status` field. |

### 9.2 Auth (`/auth`)

| Method | Path | Auth | Rate | Body | Success | Errors |
|---|---|---|---|---|---|---|
| POST | `/auth/register` | public | 5/min | `username` string non-empty · `email` valid email · `password` string **8–72 chars** · `homeInstitutionId` mongo id · `rite` `"orthodox"` · `deviceId` string non-empty | `201` `AuthTokens` | `409 "Email already registered, try logging in instead"`; `400` validation |
| POST | `/auth/login` | public | 10/min | `email` · `password` (non-empty; **no length rule**) · `deviceId` | `201` `AuthTokens` | `401 "Invalid credentials"` |
| POST | `/auth/refresh-token` | public | 20/min | `refreshToken` string non-empty | `201` `RefreshedTokens` | `401 "Invalid refresh token"` / `"Refresh token expired"` / `"User not found"` |
| POST | `/auth/logout` | logged-in | 20/min | `sessionId` mongo id | `201`, **empty body** | A `sessionId` that isn't yours is silently ignored. |
| POST | `/auth/change-password` | logged-in | 5/min | `currentPassword` non-empty · `newPassword` **8–72 chars** | `201` `{ "message": "Password changed. Please log in again." }` | `400 "Current password is incorrect"`; `400 "New password must be different from the current password"` |

Notes
- Registration **always** creates role `user`. There is no username uniqueness; **email is unique** (case-insensitive: stored lowercased).
- `username` at registration has no length limit, but editing it later (`PATCH /users/me`) requires 2–50 chars — enforce 2–50 in your register form.
- `homeInstitutionId` must be well-formed; ⚠️ the server **doesn't check the institution exists** at registration. Pick it from `GET /institutions` / nearby so it's always real.
- bcrypt truncates passwords at 72 bytes — hence the max. (Multi-byte characters like Arabic count as 2+ bytes, so a 72-char Arabic password may effectively be shortened.)
- A successful register also logs the user in (tokens returned).

### 9.3 Profile (`/users/me`)

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/users/me` | logged-in | — | `Profile` (`404 "User not found."` if the account was deleted) |
| PATCH | `/users/me` | logged-in | `username` string 2–50 (optional) · `homeInstitutionId` mongo id (optional) | updated `Profile`. `404` if that institution doesn't exist. Empty body → returns the current profile unchanged. |
| DELETE | `/users/me` | logged-in | `password` string non-empty, max 72 | `204`, empty. |

`DELETE /users/me` errors: `401 "Incorrect password."` (⚠️ a business 401 — don't auto-refresh), `403 "A superAdmin cannot delete their own account."`, `409 "Cannot delete account while sole admin of an institution. Assign another admin first."`, `404 "User not found."`. On success clear all local data/tokens.

You cannot change the email, password (use change-password), rite or role here.

### 9.4 Institutions (`/institutions`)

An institution is a church or a monastery. See the `Institution` type in §8 (note: `location.coordinates` is **[longitude, latitude]**).

| Method | Path | Auth | Input | Response |
|---|---|---|---|---|
| GET | `/institutions` | public | optional query: `name` (≤100 chars, partial, case-insensitive) · `type` `church`/`monastery` · `rite` `orthodox`; combine freely | `Institution[]` (unsorted, no paging, no `admins`) |
| GET | `/institutions/nearby` | public | see §9.5 | `Institution[]` nearest first |
| GET | `/institutions/:id` | public | — | `Institution` · `404` if missing |
| POST | `/institutions` | **superAdmin** | body below | `201` `Institution` |
| PATCH | `/institutions/:institutionId` | institution admin | any of the editable fields below | updated `Institution` |
| PATCH | `/institutions/:id/admins` | **superAdmin** | `{ userId }` mongo id | updated institution **including `admins`** (array of user ids) |
| DELETE | `/institutions/:id` | **superAdmin** | — | `200`, empty body |

**`POST /institutions` body**

| Field | Rule |
|---|---|
| `name` | string, non-empty (trimmed) — required |
| `type` | `"church"` or `"monastery"` — required |
| `rite` | `"orthodox"` — required |
| `maxAttendance` | integer ≥ 1 — required (capacity of the main sanctuary) |
| `bufferMinutes` | integer ≥ 0 — optional, default **30** |
| `address` | string — optional. Geocoded through OpenStreetMap Nominatim into coordinates + the country name (English). |
| `town` | string — optional fallback if `address` is missing or can't be resolved. ⚠️ Currently the only known value is exactly `"Kousba"` (case-sensitive; country is set to Lebanon). |

At least one of `address`/`town` must resolve, else `400 "Could not resolve a location from the provided address or town."`. `currency` (`USD`) and `timezone` (`Asia/Beirut`) cannot be provided — they're fixed. A new institution has **no admins and no salons**. Geocoding calls an external service with a 5-second timeout, so expect this one request to be slower than the rest. There is no way to send raw lat/lng.

**`PATCH /institutions/:institutionId` — editable fields (all optional)**

| Field | Rule |
|---|---|
| `name` | string 2–100 chars (trimmed) |
| `description` | string ≤ 2000 |
| `phone` | `+`? followed by 8–15 digits only, e.g. `"+96170123456"` (message: `phone must be 8 to 15 digits, with an optional leading +`) |
| `instagramUrl`, `facebookUrl`, `mapsUrl`, `coverImage` | valid URL (with scheme and real domain) |
| `maxAttendance` | integer ≥ 1 |
| `bufferMinutes` | integer ≥ 0 |

Not editable here: `type`, `rite`, `currency`, `timezone`, `location`, `country`, `salons` (use the salon endpoints), `admins`. Only sent fields change. Errors: `404` if the institution doesn't exist (superAdmin), `403`/`400` per §5 for churchAdmins.

**`PATCH /institutions/:id/admins`** — assigns an existing user as churchAdmin of this institution and sets their `role` to `churchAdmin` (see §7.3). Errors: `404` institution or user not found · `400` the user is a superAdmin · `400` already an admin of this institution · `400` institution already has 5 admins. The affected user must refresh their token to be treated as an admin (§5). **You need the target user's id** and there is no API to look one up (§13).

**`DELETE /institutions/:id`** — destructive cascade (see §7.3). Confirm with the user in the UI.

### 9.5 Nearby search — `GET /institutions/nearby` (public)

| Query | Type / rule | Notes |
|---|---|---|
| `lat` | number, −90…90, **required** | |
| `lng` | number, −180…180, **required** | |
| `maxDistance` | number ≥ 1, **metres**, optional | default `10000` (10 km) |
| `rite` | `"orthodox"`, optional | |
| `includeAllCountries` | string, optional | ⚠️ only the exact string `"true"` counts as true; anything else is false |

Results are an array of `Institution` sorted **nearest first**, with no distance field (compute distance on the client if you want to show "2.3 km").

**Country rule:** if your `lat`/`lng` fall inside the rough Lebanon bounding box (lat 33.0–34.7, lng 35.1–36.6), results are restricted to institutions whose `country` is `"Lebanon"` — unless `includeAllCountries=true`. Outside that box there is no country filter. Returns `[]` when nothing is in range. Remember `coordinates` come back as `[lng, lat]`, the reverse of what most map libraries take for `LatLng` constructors.

### 9.6 Salons (`/institutions/:institutionId/salons`)

A salon is an extra bookable room, stored *inside* the institution (`institution.salons[]`). **There is no GET for salons** — read them from the institution object. A booking with no `salonId` means the main sanctuary.

| Method | Path | Auth | Body | Response | Errors |
|---|---|---|---|---|---|
| POST | `/institutions/:institutionId/salons` | institution admin | `name` string **2–50** (trimmed) · `maxAttendance` integer ≥ 1 | `201` `{ _id, name, maxAttendance }` | `404` institution; `409 "A salon with this name already exists in this institution."` (case-insensitive) |
| PATCH | `/institutions/:institutionId/salons/:salonId` | institution admin | `name` and/or `maxAttendance` (same rules, both optional) | `{ _id, name, maxAttendance }` | `404` institution/salon; `409` duplicate name |
| DELETE | `/institutions/:institutionId/salons/:salonId` | institution admin | — | `200`, empty | `404`; `409 "This salon has active or pending bookings and cannot be deleted."` |

Delete is blocked only by `requested`/`approved` bookings whose `endsAt` is still in the future. Changing a salon's `maxAttendance` does not re-check existing bookings.

### 9.7 Follows

| Method | Path | Auth | Response | Errors |
|---|---|---|---|---|
| POST | `/institutions/:institutionId/follow` | logged-in | `201` `Follow` | `404` institution; `409 "Already following this institution"` |
| DELETE | `/institutions/:institutionId/follow` | logged-in | `200` `{ "message": "Unfollowed successfully." }` | `404 "Not following this institution"` |
| GET | `/users/me/follows` | logged-in | `Institution[]` (full objects; `[]` if none; no `admins`; unsorted) | |

There is no "am I following this?" endpoint: fetch `/users/me/follows` once and derive the flag (update it locally after follow/unfollow). The institution's `followerCount` is returned on every institution object.

### 9.8 Home feed — `GET /institutions/:institutionId/home-feed` (public)

Returns up to **5** upcoming items, soonest first:

```json
[
  { "label": "mass",          "occursAt": "2026-10-11T06:30:00.000Z" },
  { "label": "Parish picnic", "occursAt": "2026-10-14T07:00:00.000Z" }
]
```

`label` is `"mass"`, `"regular_prayer"` (map these to localized strings yourself) or an **event title** (free text). Items carry no id and no kind, so you can't link an item to its source and can't distinguish an event titled "mass" from a service. It is a "what's next" teaser; for full lists use schedules + events. How it is computed: §10.2. Unknown institution id → returns `[]` (no 404).

### 9.9 Recurring schedules (`/institutions/:institutionId/schedules`)

A schedule row = "every `dayOfWeek` at `time` there is a `serviceType`". At most one row per (institution, dayOfWeek, time).

| Field | Rule |
|---|---|
| `dayOfWeek` | integer 0–6, **0 = Sunday** (JS `getDay()` convention) |
| `time` | `"HH:mm"`, 24-hour, e.g. `"09:30"`, `"18:00"` (regex `^([01]\d|2[0-3]):[0-5]\d$`; `"9:30"` is rejected) |
| `serviceType` | `"mass"` or `"regular_prayer"` |

| Method | Path | Auth | Body | Response | Errors |
|---|---|---|---|---|---|
| GET | `…/schedules` | public | — | `Schedule[]` sorted by dayOfWeek then time | — |
| POST | `…/schedules` | institution admin | all three fields required | `201` `Schedule` | `404` institution; `409 "A schedule already exists for this institution on this day and time. Update it instead."` |
| PATCH | `…/schedules/:id` | institution admin | any of the three | updated `Schedule` | `404`; `409` duplicate |
| DELETE | `…/schedules/:id` | institution admin | — | `{ "message": "Schedule deleted successfully." }` | `404` |

There is no endpoint that lists a schedule's concrete upcoming dates; render the weekly table from this list, and use the home feed for "next up".

### 9.10 Schedule exceptions (`/institutions/:institutionId/schedule-exceptions`)

An exception changes **one specific day** relative to the weekly schedule.

| `action` | Meaning | Needs |
|---|---|---|
| `cancel` | The schedule's service on that day doesn't happen | `date` only |
| `override` | The service that day happens at a different time | `date` + `time` |
| `special` | An *additional* one-off service that day | `date` + `time` + `serviceType` |

| Field | Rule |
|---|---|
| `date` | ISO date string |
| `action` | `cancel` / `override` / `special` |
| `time` | `"HH:mm"` 24h. **Required** when action is `override` or `special`; if sent for `cancel` it is still format-checked. |
| `serviceType` | `mass` / `regular_prayer`. **Required** when action is `special`; if sent otherwise it's still validated. |

| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `…/schedule-exceptions` | public | optional query `from`, `to` (ISO; filter on `date`; unvalidated; **unsorted**) | `ScheduleException[]` |
| POST | `…/schedule-exceptions` | institution admin | `date`, `action` + conditional fields | `201` `ScheduleException` (`404` institution; `409` duplicate) |
| PATCH | `…/schedule-exceptions/:id` | institution admin | any of `date`, `action`, `time`, `serviceType` | updated exception |
| DELETE | `…/schedule-exceptions/:id` | institution admin | — | `{ "message": "Schedule exception deleted successfully." }` |

Details & traps:
- ⚠️ On **PATCH**, `time` is only checked to be a string (no `HH:mm` format check — your form must enforce it), but the server re-validates the *final* row: switching to `override`/`special` without a time, or to `special` without a `serviceType`, gives `400`.
- ⚠️ Uniqueness is on the **exact `date` timestamp** (`409 "An exception already exists for this institution on this date — update it instead."`). Two exceptions for the same calendar day but different timestamps both save, and the feed only honours one of them. **Always send the same time-of-day for the date field** — recommended: noon UTC of the target day (e.g. `"2026-12-25T12:00:00Z"`) — so the same day always produces the same timestamp and falls on that calendar day in both UTC and Beirut.
- An exception only affects the **next** occurrence of the weekly schedule that the home feed shows (§10.2); it's not a general calendar override.

### 9.11 Events

**Event** — see `EventItem` in §8. `likeCount` is always `0`.

| Method | Path | Auth | Input | Response |
|---|---|---|---|---|
| GET | `/events` | public | query: `search` (title, partial, case-insensitive) · `institutionId` (mongo id) · `from`/`to` (ISO, on `startsAt`) · `page` (≥1, default 1) · `limit` (1–50, default 20) | `Page<EventItem>`; each item's `institutionId` is expanded to `{ _id, name }` |
| GET | `/events/:id` | public | — | `EventItem` (`institutionId` is a plain id) · `404` |
| GET | `/institutions/:institutionId/events` | public | optional query `from`, `to` (ISO; unvalidated) | `EventItem[]`, soonest first, **includes past events** unless you pass `from` |
| POST | `/institutions/:institutionId/events` | institution admin | `title` string non-empty ≤200 · `startsAt` ISO · `description` string ≤2000 (opt) · `image` URL (opt) · `endsAt` ISO (opt) | `201` `EventItem` |
| PATCH | `/institutions/:institutionId/events/:id` | institution admin | any of `title` (≤200), `description` (≤2000), `image`, `startsAt`, `endsAt` | updated `EventItem` |
| DELETE | `/institutions/:institutionId/events/:id` | institution admin | — | `{ "message": "Event deleted successfully." }` |

⚠️ **Two different defaults:** `GET /events` (global) defaults `from` to **now** (upcoming only; pass an explicit past `from` for history). `GET /institutions/:id/events` defaults to **everything** (past + future). `total` in the global search counts all matches ignoring paging.
- PATCH/DELETE return `404` if the event exists but belongs to a different institution.
- Creating an event notifies all followers (`event_created`). Editing/deleting doesn't.
- No check that `endsAt` is after `startsAt` — validate in your form.

### 9.12 News

**News** — see `NewsItem` in §8.

| Method | Path | Auth | Input | Response |
|---|---|---|---|---|
| GET | `/institutions/:institutionId/news` | public | optional query `from`, `to` (ISO; on `publishedAt`; unvalidated) | `NewsItem[]`, **newest first** |
| GET | `/news/:id` | public | — | `NewsItem` · `404` |
| POST | `/institutions/:institutionId/news` | institution admin | `title` non-empty ≤200 · `body` non-empty ≤5000 · `image` URL (opt) · `publishedAt` ISO (opt, default now) | `201` `NewsItem` |
| PATCH | `/institutions/:institutionId/news/:id` | institution admin | any of `title`, `body`, `image`, `publishedAt` | updated `NewsItem` |
| DELETE | `/institutions/:institutionId/news/:id` | institution admin | — | `{ "message": "News deleted successfully." }` |

No global news feed or search — only per-institution lists and by-id lookup. To build a "news from my followed institutions" feed, call the per-institution endpoint for each followed institution and merge client-side. Creating news sends **no** notification. A future `publishedAt` is allowed and shows up in the list immediately (no "scheduled" concept).

### 9.13 Bookings

#### Concepts
- Types users can request: `wedding`, `baptism`, `engagement`. `funeral` can only be created by an admin.
- **Space:** omit `salonId` ⇒ the main sanctuary (capacity `institution.maxAttendance`). Provide `salonId` ⇒ that salon (capacity `salon.maxAttendance`). Conflicts/capacity are checked **per space** (sanctuary and salons never conflict with each other).
- **Statuses:** `requested` → (`approved` | `rejected` | `cancelled`); `approved` → `cancelled`. `rejected` and `cancelled` are final.

```
   user POST ──▶ requested ──admin approve──▶ approved ──cancel (owner or admin)──▶ cancelled
                     │                           
                     ├──admin reject──▶ rejected
                     └──cancel (owner or admin)──▶ cancelled

   admin POST /funeral ──▶ approved   (no request step, no conflict check)
```

#### Endpoints

| Method | Path | Auth | Input | Response |
|---|---|---|---|---|
| POST | `/institutions/:institutionId/bookings` | logged-in | `bookingType` `wedding`/`baptism`/`engagement` · `startsAt` ISO · `endsAt` ISO · `headcount` integer ≥1 · `salonId` mongo id (opt) · `notes` string ≤1000 (opt) | `201` `Booking` (`status: "requested"`, `userId` = caller) |
| POST | `/institutions/:institutionId/bookings/funeral` | institution admin | same, **without** `bookingType` (sending it ⇒ `400`) | `201` `Booking` (`status: "approved"`, `bookingType: "funeral"`, `userId` = the admin) |
| GET | `/institutions/:institutionId/bookings` | institution admin | optional query: `status` (`requested`/`approved`/`rejected`/`cancelled`) · `from`/`to` (ISO, on `startsAt`, inclusive) — unknown keys ⇒ `400` | `Booking[]` oldest `startsAt` first, **all users'** bookings |
| PATCH | `/institutions/:institutionId/bookings/:id/approve` | institution admin | none | `Booking` (approved) |
| PATCH | `/institutions/:institutionId/bookings/:id/reject` | institution admin | none | `Booking` (rejected) |
| PATCH | `/institutions/:institutionId/bookings/:id/cancel` | institution admin | none | `Booking` (cancelled) — admin cancelling anyone's booking |
| PATCH | `/bookings/:id/cancel` | logged-in (owner only) | none | `Booking` (cancelled) — self-service |
| GET | `/users/me/bookings` | logged-in | — | the caller's `Booking[]`, **newest `startsAt` first** (all statuses) |

#### Validation order for `POST …/bookings` (first failure wins)
1. `404 "Institution not found"`
2. `400 "Start time must be before end time"`
3. `400 "Start time cannot be in the past"`
4. `400 "Salon not found in this institution"` (salonId not in that institution's `salons`)
5. `400 "Headcount exceeds maximum attendance of <N>"`
6. `409 "Booking conflicts with existing booking"`

(Body-shape errors from the DTO come first, as `400` arrays.) Funeral creation runs the same checks **except** the "in the past" check (#3) and the conflict check (#6).

#### Conflict rule
- Only **`approved`** bookings block a slot. Many `requested` bookings can overlap; the clash is detected when an admin **approves** (then `409 "Booking conflicts with existing booking"`).
- There must be at least `institution.bufferMinutes` (default 30) between the new booking and any approved booking in the **same space**: a booking that ends at 16:00 blocks a new one starting before 16:30.
- Cancel/reject frees the slot.
- Funerals are exempt: an admin can create one over an approved booking; that other booking is **not** auto-cancelled (an admin should cancel it manually). After a funeral exists, new requests overlapping it get `409`, and pending ones can't be approved.

#### State-change errors
| Action | Wrong state | Not found |
|---|---|---|
| approve | `400 "A booking that is <status> cannot be approved"` | `404 "Booking not found"` (also if it belongs to another institution) |
| reject | `400 "A booking that is <status> cannot be rejected"` | `404 "Booking not found"` |
| admin cancel | ⚠️ **`409`** `"A booking that is <status> cannot be cancelled"` | `404 "Booking not found"` |
| owner cancel | ⚠️ **`400`** `"A booking that is <status> cannot be cancelled"` | `404 "Booking not found"` (also if it isn't yours) |

Approve re-checks conflicts at that moment (`409`) and can fail even if the request was fine when created. Approve/reject/admin-cancel each send the owner a `booking_status` notification; owner-cancel does not.

Booking list and booking object limitations: `Booking` contains no institution name, no salon name, no user name. See §7.4 for the joins.

### 9.14 Books (`/books`) — global library

| Method | Path | Auth | Input | Response |
|---|---|---|---|---|
| GET | `/books` | public | optional query: `search` (matches title **or** author, partial, case-insensitive) · `prayerType` (exact match string) | `Book[]` sorted by `title` (no paging) |
| GET | `/books/:id` | public | — | `Book` · `404` |
| POST | `/books` | **superAdmin** | `title` non-empty ≤200 · `fileUrl` URL (**required**) · `author` ≤200 · `prayerType` string · `description` ≤2000 · `language` non-empty string (default `"ar"`) · `coverUrl` URL | `201` `Book` |
| PATCH | `/books/:id` | **superAdmin** | any of the create fields | updated `Book` |
| DELETE | `/books/:id` | **superAdmin** | — | `{ "message": "Book deleted successfully." }` |

`prayerType` is free text with no fixed list, so build filter chips from the values in the returned books rather than hard-coding.

### 9.15 Quotes — `GET /quotes/today` (public)

Returns one verse of the day: `{ "book": "يوحنا", "chapter": 1, "verse": 35, "text": "…" }`. Arabic (Van Dyck translation), with full diacritics — use a font with good Arabic diacritic support and RTL layout. There are 365 verses; the pick is `dayOfYear % 365`, using the **server's** local calendar day (flips at the server's local midnight). No history or by-date lookup. `404 "No verses are available."` only if the data file were empty.

### 9.16 Notifications (`/notifications`, all logged-in)

| Method | Path | Input | Response |
|---|---|---|---|
| GET | `/notifications` | query `page`, `limit` (see §4.8) | `Page<AppNotification>`, newest first |
| GET | `/notifications/unread-count` | — | `{ "count": 3 }` |
| PATCH | `/notifications/read-all` | — | `{ "modifiedCount": 3 }` |
| PATCH | `/notifications/:id/read` | — | the updated `AppNotification` (`read: true`); `404 "Notification not found"` if missing or not yours |

Notification types and how to deep-link (`refId` is the id of the thing the notification is about):

| `type` | Created when | `refId` is | Link target |
|---|---|---|---|
| `event_created` | An admin creates an event at an institution you follow | event id | `GET /events/:refId` |
| `event_reminder` | Daily 18:00 (Asia/Beirut) job: a followed institution has an event starting **tomorrow** | event id | `GET /events/:refId` |
| `booking_status` | Your booking was approved / rejected / cancelled by an admin | booking id | find in `GET /users/me/bookings` |
| `booking_reminder` | Daily 18:00 job: your **approved** booking starts tomorrow | booking id | find in `GET /users/me/bookings` |

Notes
- `title` and `body` are **English strings built by the server**. If the app is Arabic/bilingual, build your own localized text from `type` (and fetch the referenced item), and treat `title`/`body` as a fallback.
- Delivery is pull-only: poll `unread-count` (e.g. on app foreground, on tab focus, every minute or two while the app is open).
- Reminders never repeat for the same item on the same day. The referenced event/booking may have been deleted since — handle a `404`.
- Funerals are "approved bookings" too, so the admin who created one gets a `booking_reminder` the day before.
- Notifications are deleted automatically after 60 days.

---

## 10. Business logic deep dives

### 10.1 Booking, step by step (user and admin side)

**User side**
1. Choose institution (`GET /institutions/:id` gives `maxAttendance`, `bufferMinutes`, `salons[]`).
2. Choose the space: sanctuary (omit `salonId`) or a salon. Limit the headcount field to that space's capacity.
3. Choose start/end (must be in the future, start before end). Convert to UTC ISO.
4. `POST /institutions/:id/bookings` → `requested`. Show "pending approval".
5. Track in `GET /users/me/bookings`; poll or use notifications to see approval/rejection.
6. Cancel with `PATCH /bookings/:id/cancel` (allowed while `requested` or `approved`).

**Admin side**
1. `GET /institutions/:id/bookings?status=requested` — the inbox. (No user names; see §13.)
2. Approve → may return `409` if another booking got approved for that slot meanwhile; show a clear message.
3. Reject, or cancel an already-approved booking (`409` if it's already rejected/cancelled).
4. Funeral: `POST …/bookings/funeral`.
5. A calendar view = `GET …/bookings?status=approved&from=…&to=…`.

### 10.2 The home feed algorithm

For one institution, at request time `now`:
1. **Weekly schedule rows**: for each row compute its **next** occurrence (the next date with that `dayOfWeek` at `time`; if today's time has already passed, next week). Only one occurrence per row.
2. **Apply exceptions** to those occurrences: look for an exception on the same day with action `cancel` (the occurrence is **removed** — it is not replaced by the following week) or `override` (same day, new time).
3. **Specials**: `special` exceptions from now to now+30 days become extra items (at their `time`), if still in the future.
4. **Events** with `startsAt` from now to now+30 days.
5. Merge all, sort by time ascending, **keep the first 5**.

Consequences for the UI:
- It is a teaser of "what's next", not a calendar. Don't use it to draw a month view.
- A cancelled Sunday mass disappears from the feed until it has passed (the following Sunday isn't substituted).
- "Same day" and "next occurrence" are evaluated in the **server's** time zone (§4.3). If the server isn't in `Asia/Beirut`, feed times can be wrong by the zone difference.
- `label` for services is the raw enum (`mass`, `regular_prayer`) — localize it.

To render a *full* weekly timetable: `GET …/schedules` (+ `GET …/schedule-exceptions?from=…&to=…` to flag cancelled/changed days).

### 10.3 Schedules vs exceptions vs events

- **Schedule** = repeating weekly rule. **Exception** = a one-day tweak of that rule (cancel / move / add extra). **Event** = a standalone dated happening with a title, image, description (parish picnic, feast day).
- Only schedules/exceptions/events feed the home feed. News and bookings do not.

### 10.4 Notifications lifecycle
- Event creation → rows immediately created for each follower.
- Booking approve/reject/admin-cancel → one row for the booking's owner.
- Daily 18:00 Beirut → reminders for the next Beirut calendar day; each (user, item) at most once per day.
- All creation is best-effort: failures are only logged server-side and never fail the originating request.
- Read state is per notification; `read-all` flips every unread one.

### 10.5 Follow count & feed of followed institutions
`followerCount` is a stored counter that is adjusted on follow/unfollow/account delete. There's no "followed institutions' news/events" aggregate endpoint: loop over `GET /users/me/follows` and call the per-institution endpoints (or `GET /events?institutionId=…` for events, one call per institution).

---

## 11. Screen-by-screen guide

### 11.1 First launch / onboarding
1. Generate and persist `deviceId` (UUID v4).
2. Ask for location permission → `GET /institutions/nearby?lat=…&lng=…` (or let the user search with `GET /institutions?name=…`, optionally `&type=church|monastery`).
3. User picks their home parish → **Register** form (username 2–50, email, password 8–72, rite fixed to `orthodox`, `homeInstitutionId` from step 2, `deviceId`) → store tokens.

### 11.2 Login / logout / account
- Login: email + password + `deviceId`. Show "Invalid credentials" on `401`.
- Logout: `POST /auth/logout { sessionId }` → clear storage (don't wait on failure).
- Settings → change password (current + new) → on success clear tokens and go to login.
- Settings → edit profile: username, home parish (`PATCH /users/me`).
- Settings → delete account (password confirm → `DELETE /users/me` → clear everything). Handle `409` (sole admin) and `403` (superAdmin).

### 11.3 Home tab
- `GET /users/me` (cache; gives `homeInstitutionId`, role).
- `GET /institutions/:homeInstitutionId` (name, cover image, links).
- `GET /institutions/:homeInstitutionId/home-feed` (next 5 items).
- `GET /quotes/today` (verse card).
- `GET /notifications/unread-count` (badge).

### 11.4 Discover / search
- Search by name/type: `GET /institutions?name=&type=`.
- Map/nearby: `GET /institutions/nearby` (remember `[lng, lat]`).
- Events search: `GET /events?search=&institutionId=&from=&to=&page=&limit=` (infinite scroll using `page` and `total`).

### 11.5 Institution detail page
Load in parallel: `GET /institutions/:id`, `…/schedules`, `…/schedule-exceptions?from=<today>`, `…/events?from=<now>`, `…/news`. Follow/unfollow button (state from `/users/me/follows`). Phone/Instagram/Facebook/Maps links from the institution object (any may be absent). "Book a ceremony" CTA.

### 11.6 My bookings
`GET /users/me/bookings` + resolve institution/salon names (§7.4). Group by status. Cancel button for `requested`/`approved` (confirm dialog). Disable cancel for `rejected`/`cancelled` (they'd return `400`).

### 11.7 Notifications screen
`GET /notifications?page=` with infinite scroll; tap → `PATCH /notifications/:id/read` then deep link per §9.16; "Mark all read" → `PATCH /notifications/read-all`.

### 11.8 Library
`GET /books?search=&prayerType=`, open `fileUrl` (PDF/web) externally or in an in-app viewer; show `coverUrl`; default `language` is `ar`.

### 11.9 Church-admin area (show if `role` is `churchAdmin` or `superAdmin`)
Which institutions? `churchAdmin` → `managedInstitutionIds` from `GET /users/me` (let them pick if more than one). `superAdmin` → `GET /institutions`.
- **Dashboard:** bookings inbox (`requested`), approve/reject.
- **Calendar:** approved bookings via `?status=approved&from&to`; funeral creation.
- **Institution profile editor:** `PATCH /institutions/:institutionId`.
- **Salons:** list from the institution object; add / rename / change capacity / delete (handle `409`).
- **Schedules:** weekly table CRUD (handle `409`).
- **Exceptions:** cancel / override / special for a given day (use a constant time-of-day for the `date` field, §9.10).
- **Events** and **News:** CRUD. Remember image fields are URLs.

### 11.10 Super-admin area
- Create institution (name, type, rite, capacity, buffer, address or town "Kousba").
- Assign admin by **user id** (needs the target's id, §13). After assigning, that user must refresh/re-login.
- Delete institution (big warning: wipes events, news, bookings, follows, schedules, exceptions).
- Books library CRUD.

### 11.11 Refreshing the UI after role changes
After login/refresh, also call `GET /users/me` so the app knows the current role and `managedInstitutionIds`. If the user was just promoted, call `POST /auth/refresh-token` first, then `GET /users/me`.

---

## 12. Gotchas checklist

**Auth**
- [ ] `deviceId` generated once per install, persisted, sent on register + login.
- [ ] Save the **new** refresh token after every refresh; refresh is **single-flight**.
- [ ] Only refresh on `401` with `message === "Unauthorized"` (§6.4). Don't refresh on login / delete-account 401s.
- [ ] Keep `sessionId` from login/register for logout; refresh doesn't return it.
- [ ] After change-password or delete-account, wipe tokens and navigate to login.
- [ ] After a role change, refresh the token; the role in the JWT is what the server enforces.

**Requests**
- [ ] No extra properties in bodies; no extra query params on the validated lists (§4.4).
- [ ] Never send `null` or `""` to "clear" a field.
- [ ] URLs must be `https://real-domain.tld/...`; `localhost` URLs are rejected.
- [ ] Dates as UTC ISO with `Z`; `HH:mm` times with leading zeros.
- [ ] `DELETE /users/me` needs a body.

**Responses**
- [ ] Don't `.json()` empty responses (logout, delete institution, delete salon, delete account).
- [ ] `GET /users/me` uses `id`; everything else uses `_id`.
- [ ] `coordinates` is `[lng, lat]`.
- [ ] Optional fields are absent, not null. Ignore `__v`.
- [ ] `GET /events` items have `institutionId: { _id, name }`; other event responses have a plain id.
- [ ] Only events search and notifications are paginated; everything else is a full array.
- [ ] Error `message` may be a string or an array.
- [ ] HTTP 201 for POST (including login/refresh/logout).

**Domain rules**
- [ ] Booking: start must be future (users), start < end, headcount ≤ space capacity, sanctuary vs salon is decided by `salonId` presence.
- [ ] Booking conflict only against **approved** bookings, with `bufferMinutes` gap, per space; funerals ignore conflicts.
- [ ] Admin-cancel conflicts return `409`; owner-cancel returns `400` for "already rejected/cancelled".
- [ ] `GET /events` = upcoming only by default; `/institutions/:id/events` = everything by default.
- [ ] Exceptions: use one fixed time-of-day for the `date` so the "one per day" uniqueness actually works.
- [ ] Home feed has ≤5 items, no ids; service labels are raw enums.
- [ ] Notification text is English; localize from `type`.
- [ ] Nobody (not even a superAdmin) can list users, so keep the user's own id visible somewhere (profile screen) for the assign-admin flow.
- [ ] Rate limits: 5/min on register and change-password, 10/min on login.

---

## 13. Missing from the backend (ask the backend owner)

These are real gaps that will block certain screens. Raise them early so the backend can add endpoints:

1. **Find a user** (by email/username) — needed by the superAdmin "assign church admin" screen (currently requires the raw user id). Workaround: ask the future admin to copy the `id` from their profile screen and send it.
2. **List / remove an institution's admins.**
3. **User names on admin booking lists** — admins only see `userId`. Workarounds: none via API; consider adding a populated `{ username, email }` field.
4. **Get a single booking by id** — notification deep links for bookings must search the user's whole booking list.
5. **Salon list endpoint** — salons are only visible inside the institution object (fine, but note it).
6. **"Am I following this institution?"** flag on institution detail.
7. **Image/file upload** — all media are URLs hosted elsewhere.
8. **Push notifications**, **forgot-password/email verification**, **likes**, **global news feed**, **pagination on lists**, **distance in nearby results**, **lat/lng input when creating an institution** (only an address or the hard-coded town "Kousba").
9. **Server time zone** — confirm the server runs in `Asia/Beirut` (home feed, exception matching and verse-of-day use server-local time).
10. **Registration doesn't verify `homeInstitutionId` exists** (a hand-crafted request can create a user pointing at nothing) — front end should only send ids it got from the API.

---

## 14. Full endpoint index

60 routes. `A` = institution admin (superAdmin or that institution's churchAdmin), `S` = superAdmin, `L` = logged-in, `P` = public.

| # | Method | Path | Who | Purpose | Success |
|---|---|---|---|---|---|
| 1 | GET | `/health` *(no /v1)* | P | Liveness of Mongo + Redis | 200 |
| 2 | POST | `/auth/register` | P | Create account + log in | 201 |
| 3 | POST | `/auth/login` | P | Log in | 201 |
| 4 | POST | `/auth/refresh-token` | P | Rotate tokens | 201 |
| 5 | POST | `/auth/logout` | L | End a session | 201 (empty) |
| 6 | POST | `/auth/change-password` | L | Change password, revoke all sessions | 201 |
| 7 | GET | `/users/me` | L | My profile | 200 |
| 8 | PATCH | `/users/me` | L | Edit username / home parish | 200 |
| 9 | DELETE | `/users/me` | L | Delete my account | 204 |
| 10 | GET | `/users/me/follows` | L | Institutions I follow | 200 |
| 11 | GET | `/users/me/bookings` | L | My bookings | 200 |
| 12 | GET | `/institutions` | P | List/search institutions | 200 |
| 13 | GET | `/institutions/nearby` | P | Geo search | 200 |
| 14 | GET | `/institutions/:id` | P | One institution | 200 |
| 15 | POST | `/institutions` | S | Create institution | 201 |
| 16 | PATCH | `/institutions/:institutionId` | A | Edit institution | 200 |
| 17 | PATCH | `/institutions/:id/admins` | S | Assign a church admin | 200 |
| 18 | DELETE | `/institutions/:id` | S | Delete institution + cascade | 200 (empty) |
| 19 | POST | `/institutions/:institutionId/salons` | A | Add salon | 201 |
| 20 | PATCH | `/institutions/:institutionId/salons/:salonId` | A | Edit salon | 200 |
| 21 | DELETE | `/institutions/:institutionId/salons/:salonId` | A | Delete salon | 200 (empty) |
| 22 | POST | `/institutions/:institutionId/follow` | L | Follow | 201 |
| 23 | DELETE | `/institutions/:institutionId/follow` | L | Unfollow | 200 |
| 24 | GET | `/institutions/:institutionId/home-feed` | P | Next 5 happenings | 200 |
| 25 | GET | `/institutions/:institutionId/schedules` | P | Weekly schedule | 200 |
| 26 | POST | `/institutions/:institutionId/schedules` | A | Add schedule row | 201 |
| 27 | PATCH | `/institutions/:institutionId/schedules/:id` | A | Edit schedule row | 200 |
| 28 | DELETE | `/institutions/:institutionId/schedules/:id` | A | Delete schedule row | 200 |
| 29 | GET | `/institutions/:institutionId/schedule-exceptions` | P | List exceptions | 200 |
| 30 | POST | `/institutions/:institutionId/schedule-exceptions` | A | Add exception | 201 |
| 31 | PATCH | `/institutions/:institutionId/schedule-exceptions/:id` | A | Edit exception | 200 |
| 32 | DELETE | `/institutions/:institutionId/schedule-exceptions/:id` | A | Delete exception | 200 |
| 33 | GET | `/events` | P | Global event search (paginated) | 200 |
| 34 | GET | `/events/:id` | P | One event | 200 |
| 35 | GET | `/institutions/:institutionId/events` | P | Institution's events | 200 |
| 36 | POST | `/institutions/:institutionId/events` | A | Create event (notifies followers) | 201 |
| 37 | PATCH | `/institutions/:institutionId/events/:id` | A | Edit event | 200 |
| 38 | DELETE | `/institutions/:institutionId/events/:id` | A | Delete event | 200 |
| 39 | GET | `/institutions/:institutionId/news` | P | Institution's news | 200 |
| 40 | GET | `/news/:id` | P | One news item | 200 |
| 41 | POST | `/institutions/:institutionId/news` | A | Create news | 201 |
| 42 | PATCH | `/institutions/:institutionId/news/:id` | A | Edit news | 200 |
| 43 | DELETE | `/institutions/:institutionId/news/:id` | A | Delete news | 200 |
| 44 | POST | `/institutions/:institutionId/bookings` | L | Request a ceremony | 201 |
| 45 | POST | `/institutions/:institutionId/bookings/funeral` | A | Create a funeral (auto-approved) | 201 |
| 46 | GET | `/institutions/:institutionId/bookings` | A | Institution's bookings (filters) | 200 |
| 47 | PATCH | `/institutions/:institutionId/bookings/:id/approve` | A | Approve | 200 |
| 48 | PATCH | `/institutions/:institutionId/bookings/:id/reject` | A | Reject | 200 |
| 49 | PATCH | `/institutions/:institutionId/bookings/:id/cancel` | A | Admin cancel | 200 |
| 50 | PATCH | `/bookings/:id/cancel` | L (owner) | Cancel my booking | 200 |
| 51 | GET | `/books` | P | Library search | 200 |
| 52 | GET | `/books/:id` | P | One book | 200 |
| 53 | POST | `/books` | S | Add book | 201 |
| 54 | PATCH | `/books/:id` | S | Edit book | 200 |
| 55 | DELETE | `/books/:id` | S | Delete book | 200 |
| 56 | GET | `/quotes/today` | P | Verse of the day | 200 |
| 57 | GET | `/notifications` | L | My notifications (paginated) | 200 |
| 58 | GET | `/notifications/unread-count` | L | Unread badge | 200 |
| 59 | PATCH | `/notifications/read-all` | L | Mark all read | 200 |
| 60 | PATCH | `/notifications/:id/read` | L | Mark one read | 200 |

---

### Appendix A — Example payloads

**Register**
```http
POST /v1/auth/register
{
  "username": "Fadi",
  "email": "fadi@example.com",
  "password": "correct-horse-battery",
  "homeInstitutionId": "507f1f77bcf86cd799439011",
  "rite": "orthodox",
  "deviceId": "3f0c4b0e-6f56-4c7e-9c0e-0e8f1d5f2a77"
}
→ 201 { "accessToken": "eyJ…", "refreshToken": "9b1f…(64 hex)", "sessionId": "65a…" }
```

**Create an event (admin)**
```http
POST /v1/institutions/507f1f77bcf86cd799439011/events
Authorization: Bearer eyJ…
{ "title": "Feast of St. George", "startsAt": "2027-04-23T07:00:00Z", "description": "Liturgy followed by lunch.", "image": "https://cdn.example.com/george.jpg" }
→ 201 { "_id": "…", "institutionId": "507f…", "title": "Feast of St. George", "startsAt": "2027-04-23T07:00:00.000Z", "description": "…", "image": "…", "likeCount": 0, "createdAt": "…", "updatedAt": "…", "__v": 0 }
```

**Request a wedding in a salon**
```http
POST /v1/institutions/507f…/bookings
{ "bookingType": "wedding", "startsAt": "2027-06-12T14:00:00Z", "endsAt": "2027-06-12T16:00:00Z", "headcount": 40, "salonId": "65b…", "notes": "Need microphone" }
→ 201 { "_id": "…", "userId": "…", "institutionId": "507f…", "bookingType": "wedding", "salonId": "65b…", "startsAt": "…", "endsAt": "…", "headcount": 40, "status": "requested", "notes": "Need microphone", … }
```

**Weekly schedule + a holiday exception**
```http
POST /v1/institutions/507f…/schedules        { "dayOfWeek": 0, "time": "09:30", "serviceType": "mass" }
POST /v1/institutions/507f…/schedule-exceptions
     { "date": "2026-12-27T12:00:00Z", "action": "override", "time": "11:00" }       // Sunday mass moved to 11:00
POST /v1/institutions/507f…/schedule-exceptions
     { "date": "2026-12-25T12:00:00Z", "action": "special", "time": "08:00", "serviceType": "mass" }   // extra Christmas mass
```

**Validation error**
```json
{ "statusCode": 400, "timestamp": "…", "path": "/v1/institutions/507f…/bookings",
  "message": ["headcount must not be less than 1", "startsAt must be a valid ISO 8601 date string"] }
```

**Nearby**
```
GET /v1/institutions/nearby?lat=34.30&lng=35.85&maxDistance=5000&rite=orthodox
```

**Events search, page 2**
```
GET /v1/events?search=feast&from=2026-10-01T00:00:00Z&page=2&limit=10
→ { "items": [ { "_id": "…", "institutionId": { "_id": "507f…", "name": "St. George Orthodox Church" }, "title": "…", … } ], "page": 2, "limit": 10, "total": 23 }
```
