# Ekklesia Backend — API Guide for Frontend

This guide describes what the backend actually does today. It was written by reading every controller, DTO, guard and schema in `src/`. Where the code is unclear or inconsistent, it is listed in **section 14 (Needs confirmation)** rather than guessed.

---

## 1. Getting the backend running locally

```bash
git clone <backend-repo-url>
cd EkklesiaApp-pnpnm-
pnpm install
```

Copy `.env.example` to `.env` and fill in two real secrets (run this twice, one value each for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Start Mongo and Redis, then the API:

```bash
docker compose up -d      # wait ~15s, check with: docker compose ps
pnpm run seed             # creates test institutions, a superadmin and a test user; prints the logins
pnpm run start:dev
```

- **Base URL:** `http://localhost:3000/v1` — every route below needs the `/v1` prefix.
- **Swagger UI:** `http://localhost:3000/docs`
- **Health check:** `GET http://localhost:3000/health` (no `/v1` prefix) returns `{ status: "ok" | "error", mongo: "up" | "down", redis: "up" | "down", timestamp }`.
- CORS is open to all origins.
- **Rate limit:** 100 requests per minute per client. Beyond that the API answers `429`.

> See "Needs confirmation" item 1 before relying on `pnpm run seed` on a fresh database.

---

## 2. Conventions

### Ids
Every id (`_id`, `institutionId`, `userId`, `sessionId`, `salonId`, booking ids…) is a **24-character hex string**, e.g. `"507f1f77bcf86cd799439011"`.

### Dates
Send and expect **ISO 8601** strings, and include the timezone (preferably UTC with a trailing `Z`), e.g. `"2027-06-12T14:00:00Z"`. Responses return UTC ISO strings.

### Request bodies are strict
Unknown fields are rejected, not ignored. Sending a field a DTO does not declare returns `400` with `"property <name> should not exist"`.

### Error response shape
Every error, including validation and auth errors, has this shape:

```json
{
  "statusCode": 400,
  "timestamp": "2026-10-05T11:47:58.123Z",
  "path": "/v1/institutions/abc/bookings",
  "message": "Invalid id"
}
```

`message` is a **string** for most errors and an **array of strings** for body/query validation errors (for example `["headcount must not be less than 1"]`). Unhandled server errors return `500` with `"Internal server error"`.

Common status codes: `400` validation or business rule, `401` missing/invalid/expired access token, `403` logged in but not allowed, `404` not found, `409` conflict, `429` rate limited.

### Guards (who can call what)
| Label used below | Meaning |
|---|---|
| **public** | No token needed. |
| **logged-in** | Any valid access token (`user`, `churchAdmin` or `superAdmin`). |
| **admin of institution** | `superAdmin`, **or** a `churchAdmin` who is in that institution's `admins` list. The institution comes from the `:institutionId` in the URL only. A churchAdmin of institution A gets `403` on institution B. |
| **superAdmin** | `role: "superAdmin"` only. |

Guard responses to know:
- No/invalid token: `401 {"message":"Unauthorized"}`.
- Not an admin of that institution: `403 {"message":"Forbidden resource"}`.
- superAdmin-only route called by someone else: `403 "Access denied. Super admin privileges required."`.
- A churchAdmin sending a malformed `:institutionId` on an admin route gets `400 "Invalid id"`; a well-formed id that does not exist gets `403`.
- Bookings routes validate every id in the URL and return `400 "Invalid id"` for anything that is not exactly 24 hex characters.

---

## 3. How auth works

Every protected endpoint needs `Authorization: Bearer <accessToken>`.

1. `POST /v1/auth/register` or `POST /v1/auth/login` returns `{ accessToken, refreshToken, sessionId }`. **Store all three.**
2. The **access token** lasts **15 minutes** (`ACCESS_TTL`). It carries the user's id and role.
3. When a request fails with `401`, call `POST /v1/auth/refresh-token` with the stored refresh token. You get a **new accessToken and a new refreshToken**. The old refresh token is invalidated the moment it is used (rotation), so always save the new one. Using the old one again returns `401 "Invalid refresh token"`.
4. The **refresh token** is valid for **30 days**, and that window restarts every time it is used.
5. Refresh does **not** return `sessionId`. Keep the one from login/register; you need it for logout.
6. **`deviceId`**: generate a random UUID once per app install, store it, and send the same value on every register/login. Logging in again on the same `deviceId` replaces that device's previous session, so the previous refresh token stops working.
7. **Logout** (`POST /v1/auth/logout`, logged-in) takes `{ sessionId }`, deletes that session and returns an empty body. The access token already issued stays valid until it expires (up to 15 minutes), so just discard it on the client. A `sessionId` that does not belong to you is silently ignored.
8. **Roles** are `user`, `churchAdmin`, `superAdmin`. Registration always creates `user`. The role is read from the access token, so after a superAdmin assigns someone as churchAdmin, that person gets the new role only after a **refresh or a fresh login**.

---

## 4. Auth endpoints (`/v1/auth`)

| Method | Path | Guard | Body | Success | Errors |
|---|---|---|---|---|---|
| POST | `/auth/register` | public | `username` string, non-empty · `email` valid email · `password` string, non-empty · `homeInstitutionId` 24-hex id · `rite` `"orthodox"` · `deviceId` string, non-empty | `201` `{ accessToken, refreshToken, sessionId }` | `409 "Email already registered, try logging in instead"` |
| POST | `/auth/login` | public | `email` valid email · `password` string, non-empty · `deviceId` string, non-empty | `201` `{ accessToken, refreshToken, sessionId }` | `401 "Invalid credentials"` |
| POST | `/auth/refresh-token` | public | `refreshToken` string, non-empty | `201` `{ accessToken, refreshToken }` | `401` `"Invalid refresh token"`, `"Refresh token expired"` or `"User not found"` |
| POST | `/auth/logout` | logged-in | `sessionId` 24-hex id | `201`, empty body | — |

Note that these POSTs return **201**, not 200.

`homeInstitutionId` must be a real institution id: fetch one from `GET /institutions` first.

---

## 5. Institutions (`/v1/institutions`)

### Institution object (what every institution response looks like)
```json
{
  "_id": "…",
  "name": "St. George Orthodox Church",
  "description": "optional",
  "type": "church",                    // "church" | "monastery"
  "rite": "orthodox",
  "country": "Lebanon",
  "currency": "USD",
  "timezone": "Asia/Beirut",
  "location": { "type": "Point", "coordinates": [35.8528, 34.3017] },   // [longitude, latitude]
  "maxAttendance": 200,                // capacity of the main sanctuary
  "bufferMinutes": 30,                 // gap required between approved bookings
  "salons": [ { "_id": "…", "name": "Chapel", "maxAttendance": 50 } ],  // may be empty
  "followerCount": 0,
  "createdAt": "…", "updatedAt": "…"
}
```
**Institution responses never include `admins`.** (One exception, see "Needs confirmation" item 4.) `location.coordinates` is **[longitude, latitude]**, which is the reverse of the usual "lat, lng" order.

### Endpoints
| Method | Path | Guard | Input | Response |
|---|---|---|---|---|
| GET | `/institutions` | public | optional query `name` (partial, case-insensitive), `type` (`church`/`monastery`), `rite` (`orthodox`); combinable | array of Institution objects |
| GET | `/institutions/nearby` | public | see section 6 | array of Institution objects, nearest first |
| GET | `/institutions/:id` | public | — | one Institution object; `404` if not found |
| POST | `/institutions` | **superAdmin** | body below | `201` the created Institution object |
| PATCH | `/institutions/:id/admins` | **superAdmin** | `{ userId }` string | the updated institution |
| DELETE | `/institutions/:id` | **superAdmin** | — | `200`, empty body |

**`POST /institutions` body**
| Field | Type / rule |
|---|---|
| `name` | string, non-empty |
| `type` | `"church"` or `"monastery"` |
| `rite` | `"orthodox"` |
| `maxAttendance` | integer ≥ 1, required |
| `bufferMinutes` | integer ≥ 0, optional (default 30) |
| `address` | string, optional. Geocoded to coordinates and the English country name. |
| `town` | string, optional. Fallback when `address` is missing or cannot be resolved. Currently only `"Kousba"` is known (country `"Lebanon"`). |

At least one of `address` / `town` must resolve to a location, otherwise `400 "Could not resolve a location from the provided address or town."`. `currency` (`USD`), `timezone` (`Asia/Beirut`) and `description` cannot be set through this endpoint. A new institution starts with **no admins** and **no salons**.

**`PATCH /institutions/:id/admins`**: assigns a user as churchAdmin of that institution and sets that user's `role` to `churchAdmin`. Errors: `404` institution or user not found; `400` if the user is a superAdmin, is already an admin of this institution, or the institution already has 5 admins.

**`DELETE /institutions/:id`**: deletes the institution, removes it from every admin's managed list, and sets any admin who then manages nothing back to `role: "user"`. `404` if it does not exist. See "Needs confirmation" item 5 about related records.

---

## 6. Nearby search — `GET /v1/institutions/nearby` (public)

| Query param | Type | Notes |
|---|---|---|
| `lat` | number | required |
| `lng` | number | required |
| `maxDistance` | number, **metres** | optional, default `10000` |
| `rite` | string | optional, exact match (e.g. `orthodox`) |
| `includeAllCountries` | `"true"` | optional. **Only the exact string `true` counts**; anything else (or missing) is false. |

Results are sorted nearest first. **Country rule:** if the `lat`/`lng` you send fall inside Lebanon's bounding box (lat 33.0–34.7, lng 35.1–36.6), results are limited to institutions whose `country` is `"Lebanon"`, unless `includeAllCountries=true`. If the point is outside that box, no country filter is applied at all. The response is an array of Institution objects (no `admins`). It is an empty array when nothing matches.

---

## 7. Follows

| Method | Path | Guard | Response |
|---|---|---|---|
| POST | `/institutions/:institutionId/follow` | logged-in | `201` `{ _id, userId, institutionId, createdAt, updatedAt }`. Errors: `404` institution not found; `409 "Already following this institution"`. |
| DELETE | `/institutions/:institutionId/follow` | logged-in | `200` `{ "message": "Unfollowed successfully." }`. `404 "Not following this institution"`. |
| GET | `/users/me/follows` | logged-in | array of the Institution objects the user follows (no `admins`). `[]` if none. |

Following increments and unfollowing decrements the institution's `followerCount`.

---

## 8. Home feed — `GET /v1/institutions/:institutionId/home-feed` (public)

Returns an array of **at most 5** items, soonest first:

```json
[ { "label": "mass", "occursAt": "2026-10-08T11:00:00.000Z" },
  { "label": "Parish picnic", "occursAt": "2026-10-10T10:00:00.000Z" } ]
```

The list merges three sources for that institution:
1. The next occurrence of each recurring weekly service (cancelled ones removed, time-overridden ones adjusted). `label` is the service type (`"mass"` or `"regular_prayer"`).
2. "Special" schedule exceptions in the next 30 days. `label` is the service type.
3. Events starting in the next 30 days. `label` is the event title.

Items carry only `label` and `occursAt`: no id and no item type.

> **Today the feed contains only events and special exceptions**, because no endpoint creates recurring schedule rows yet (see section 13).

---

## 9. Events

**Event object:** `{ _id, institutionId, title, description?, image?, startsAt, endsAt?, likeCount, createdAt, updatedAt }`. `likeCount` is always `0` (there is no like endpoint).

| Method | Path | Guard | Input | Response |
|---|---|---|---|---|
| GET | `/institutions/:institutionId/events` | public | optional query `from`, `to` (ISO dates, filter on `startsAt`) | array, soonest first |
| GET | `/events/:id` | public | — | one Event; `404` if not found |
| POST | `/institutions/:institutionId/events` | admin of institution | `title` string non-empty · `startsAt` ISO date · `description` string? · `image` URL? · `endsAt` ISO date? | `201` the Event |
| PATCH | `/institutions/:institutionId/events/:id` | admin of institution | any of `title`, `description`, `image`, `startsAt`, `endsAt` (same rules, all optional) | the updated Event |
| DELETE | `/institutions/:institutionId/events/:id` | admin of institution | — | `{ "message": "Event deleted successfully." }` |

PATCH and DELETE return `404` if the event does not belong to that institution.

---

## 10. News

**News object:** `{ _id, institutionId, title, body, image?, publishedAt, likeCount, createdAt, updatedAt }`. `likeCount` is always `0`.

| Method | Path | Guard | Input | Response |
|---|---|---|---|---|
| GET | `/institutions/:institutionId/news` | public | optional query `from`, `to` (ISO dates, filter on `publishedAt`) | array, **newest first** |
| GET | `/news/:id` | public | — | one News item; `404` if not found |
| POST | `/institutions/:institutionId/news` | admin of institution | `title` string non-empty · `body` string non-empty · `image` URL? · `publishedAt` ISO date? (defaults to now) | `201` the News item |
| PATCH | `/institutions/:institutionId/news/:id` | admin of institution | any of `title`, `body`, `image`, `publishedAt` | the updated News item |
| DELETE | `/institutions/:institutionId/news/:id` | admin of institution | — | `{ "message": "News deleted successfully." }` |

---

## 11. Schedule exceptions

An exception changes one day of an institution's schedule. **There is at most one exception per institution per date**; a second one for the same date returns `409 "An exception already exists for this institution on this date — update it instead."`.

**Object:** `{ _id, institutionId, date, action, time?, serviceType?, createdAt, updatedAt }`

| Field | Rule |
|---|---|
| `date` | ISO date |
| `action` | `"cancel"`, `"override"` or `"special"` |
| `time` | string such as `"09:30"`. Needed in practice for `override` and `special`. |
| `serviceType` | `"mass"` or `"regular_prayer"`. Needed in practice for `special`. |

| Method | Path | Guard | Input | Response |
|---|---|---|---|---|
| GET | `/institutions/:institutionId/schedule-exceptions` | public | optional query `from`, `to` (ISO dates) | array |
| POST | `/institutions/:institutionId/schedule-exceptions` | admin of institution | `date`, `action` required; `time`, `serviceType` optional | `201` the exception |
| PATCH | `/institutions/:institutionId/schedule-exceptions/:id` | admin of institution | any of the four fields | the updated exception |
| DELETE | `/institutions/:institutionId/schedule-exceptions/:id` | admin of institution | — | `{ "message": "Schedule exception deleted successfully." }` |

---

## 12. Bookings (weddings, baptisms, engagements, funerals)

### The flow
1. **A user requests** a wedding, baptism or engagement. The booking is created with `status: "requested"`.
2. **An admin of that institution approves or rejects it.** Only `requested` bookings can be approved or rejected.
3. **The user can cancel** their own booking while it is `requested` or `approved`.
4. **Funerals are admin-only.** An admin creates one directly and it is stored as `approved` with `bookingType: "funeral"`. There is no request or approval step.

Statuses: `requested`, `approved`, `rejected`, `cancelled`.

### Where the booking happens: `salonId`
An institution has a main space (the **sanctuary**) plus optional **salons** (rooms listed in the Institution object's `salons`). In a booking, **omitting `salonId` means the church sanctuary**. Sending a `salonId` books that salon. Capacity and conflicts are checked per space.

### Booking object
```json
{ "_id": "…", "userId": "…", "institutionId": "…",
  "bookingType": "wedding",          // wedding | baptism | engagement | funeral
  "salonId": "…",                    // only present when a salon was booked
  "startsAt": "2027-06-12T14:00:00.000Z", "endsAt": "2027-06-12T16:00:00.000Z",
  "headcount": 150, "status": "requested", "notes": "optional",
  "createdAt": "…", "updatedAt": "…" }
```

### Endpoints
| Method | Path | Guard | Input | Response |
|---|---|---|---|---|
| POST | `/institutions/:institutionId/bookings` | logged-in | `bookingType` `"wedding"` / `"baptism"` / `"engagement"` · `startsAt` ISO · `endsAt` ISO · `headcount` integer ≥ 1 · `salonId` 24-hex id? · `notes` string? | `201` the Booking (`status: "requested"`, `userId` = the caller) |
| POST | `/institutions/:institutionId/bookings/funeral` | admin of institution | same as above **without `bookingType`** (sending it returns `400`) | `201` the Booking (`status: "approved"`, `bookingType: "funeral"`, `userId` = the admin who created it) |
| GET | `/institutions/:institutionId/bookings` | admin of institution | optional query `status`, `from`, `to` (`from`/`to` filter on `startsAt`) | array, oldest `startsAt` first. Includes every user's bookings. |
| PATCH | `/institutions/:institutionId/bookings/:id/approve` | admin of institution | no body | the Booking with `status: "approved"` |
| PATCH | `/institutions/:institutionId/bookings/:id/reject` | admin of institution | no body | the Booking with `status: "rejected"` |
| PATCH | `/bookings/:id/cancel` | logged-in, **owner only** | no body | the Booking with `status: "cancelled"` |
| GET | `/users/me/bookings` | logged-in | — | the caller's bookings, **newest `startsAt` first** |

### Rules the server enforces when a user requests a booking
Checked in this order; the first failure wins:
1. Institution not found: `404 "Institution not found"`.
2. `startsAt` is not before `endsAt`: `400 "Start time must be before end time"`.
3. `salonId` given but not one of that institution's salons: `400 "Salon not found in this institution"`.
4. `headcount` above the space's capacity (the salon's `maxAttendance`, or the institution's `maxAttendance` for the sanctuary): `400 "Headcount exceeds maximum attendance of <N>"`.
5. Overlaps an **already approved** booking in the **same space**: `409 "Booking conflicts with existing booking"`.

**What counts as a conflict:** only `approved` bookings block a slot; two pending requests for the same slot can both exist. Each approved booking also reserves the institution's `bufferMinutes` (default 30) before its start and after its end. The check is per space: the sanctuary does not conflict with a salon, and two different salons do not conflict. Cancelling or rejecting frees the slot.

**Approve** re-runs the conflict check and returns `409` if another booking was approved for that space and time in the meantime. A booking that is not `requested` returns `400 "A booking that is <status> cannot be approved"` (and the same wording with "rejected" for reject). A booking id that does not exist, or belongs to a different institution, returns `404 "Booking not found"`.

**Cancel** returns `404 "Booking not found"` if the booking is not yours, and `400 "A booking that is <status> cannot be cancelled"` unless it is `requested` or `approved`.

**Funerals** skip only the conflict check: an admin can create one over an existing approved booking, and that existing booking is **not** cancelled automatically. All the other checks above still apply. Once a funeral exists, any new request overlapping it is rejected with `409`, and a pending request created earlier cannot be approved.

---

## 13. Not built yet

- **Notifications.**
- **Books / library.**
- **Per-parish store.**
- **Payments** of any kind.
- **Creating recurring weekly schedule rows.** The backend can read recurring schedules, but **no endpoint creates, edits or deletes them**. Until one exists the home feed shows only events and "special" schedule exceptions.
- **Managing an institution's `salons`.** The Institution object has a `salons` array and bookings can target a salon, but there is no endpoint to add, edit or remove a salon. Salons currently exist only if they were put in the database directly.
- **Likes** on events and news (`likeCount` is always 0).
- **User profile endpoints** (the only user routes are `GET /users/me/follows` and `GET /users/me/bookings`).
- **Editing or deleting an institution's details** beyond assigning admins and deleting it.

---

## 14. Needs confirmation

Things that look inconsistent or unclear in the code. They are listed here and not guessed.

1. **The seed script is out of date.** `src/database/seed.ts` does not set `maxAttendance`, which is now required on institutions. On an empty database `pnpm run seed` should fail validation when creating the institutions. It has not been re-run on a fresh database since that field was added. Existing databases are unaffected.
2. **`REFRESH_TTL` is not used.** The refresh token lifetime (30 days) is hard-coded in `auth.service.ts`. The `.env` value `REFRESH_TTL` does not change it.
3. **No password rules.** Registration only requires a non-empty password (no minimum length or complexity).
4. **`PATCH /institutions/:id/admins` returns the full institution including `admins`.** It returns the saved document without removing `admins`, unlike every GET. It is superAdmin-only, but it contradicts "never includes `admins`".
5. **Deleting an institution leaves related records behind.** `DELETE /institutions/:id` removes only the institution and fixes its admins' roles. Its events, news, schedule exceptions, schedules, bookings and follows are not deleted.
6. **Malformed ids on routes that do not validate them.** Bookings routes and the admin guard return a clean `400 "Invalid id"`. Other routes pass the id straight to the database: `GET /institutions/:id`, `GET /events/:id`, `GET /news/:id`, follow/unfollow, the home feed, and the events/news/schedule-exception routes when called by a **superAdmin**. A malformed id there is probably a `500`. This was not tested route by route.
7. **`assign admin` `userId`** is only checked as a string, not as an id. A malformed value probably gives a `500`.
8. **Nearby search with missing or non-numeric `lat`/`lng`** is not validated; `Number(undefined)` is `NaN`. The resulting error response was not tested.
9. **No admin cancel.** `PATCH /bookings/:id/cancel` works only for the booking's owner. An admin has no endpoint to cancel someone else's approved booking, including a booking that a funeral overlaps. A funeral's owner is the admin who created it, so only that admin can cancel it.
10. **Booking admin list has no user details.** It returns `userId` only (no name or email).
11. **No past-date check** on bookings (a request can start in the past), and no check that an event's `endsAt` is after its `startsAt`.
12. **Schedule exception `time` format is not validated** (it should be `"HH:mm"`). `override` and `special` need `time`, and `special` needs `serviceType`, but the API accepts them without. A schedule exception with `override`/`special` and no `time` may break the home feed (the feed reads it without a check).
13. **Time zones.** The home feed decides "which day" a schedule exception covers using the **server's** local time zone, while institutions have a `timezone` (`Asia/Beirut`) that is not used there.
14. **Query filters are not validated:** `status` on the bookings list (an unknown value returns `[]`), and `from`/`to` on lists (an invalid date probably errors). The `name` filter on `GET /institutions` is used as a regular expression, so special characters may produce an error.
15. **Home feed items** have no id or type, so the app cannot link an item to its event or schedule.
