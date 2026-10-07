# Ekklesia Backend — API Guide for Frontend

This guide describes what the backend actually does today. It was written by reading every controller, DTO, guard, service and schema in `src/`. Where the code is unclear or inconsistent, it is listed in **section 20 (Needs confirmation)** rather than guessed.

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
- CORS is open to all origins. Responses are gzip/br-compressed and carry `helmet`'s security headers.
- **Rate limit:** 100 requests per minute per client by default (`429` beyond that). Auth routes have their own, tighter limits — see section 4.
- Redis also backs a BullMQ queue that sends daily reminder notifications (see section 18); this runs on a schedule and is not triggered by any endpoint.

---

## 2. Conventions

### Ids
Every id (`_id`, `institutionId`, `userId`, `sessionId`, `salonId`, booking/event/news/schedule/notification ids…) is a **24-character hex string**, e.g. `"507f1f77bcf86cd799439011"`. Almost every route parameter that names an id is parsed with a pipe that rejects anything else with `400 "Invalid id"` before the controller runs (see item 6 in section 20 for the one exception).

### Dates
Send and expect **ISO 8601** strings, and include the timezone (preferably UTC with a trailing `Z`), e.g. `"2027-06-12T14:00:00Z"`. Responses return UTC ISO strings.

### Request bodies are strict
Unknown fields are rejected, not ignored. Sending a field a DTO does not declare returns `400` with `"property <name> should not exist"`.

### Query parameters are not always validated
Some query objects are plain TypeScript shapes rather than validated DTO classes (bookings list filters, institution list filters, events/news date-range filters). On those routes, unknown query keys are ignored and bad values (e.g. an unparsable date) are passed straight to MongoDB. Routes with a real DTO (`events` search, `notifications` list) reject unknown keys and out-of-range values with `400`.

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
- No/invalid/expired token: `401 {"message":"Unauthorized"}`.
- Not an admin of that institution: `403 {"message":"Forbidden resource"}` (churchAdmin with no `:institutionId` param at all), `403 "Institution not found."` (churchAdmin, institution doesn't exist), or plain `403` (churchAdmin not in that institution's `admins`).
- superAdmin-only route called by someone else: `403 "Access denied. Super admin privileges required."`.
- A churchAdmin sending a malformed `:institutionId` on an admin route gets `400 "Invalid id"` (the id pipe runs before the guard); a well-formed id that does not exist gets `403`.
- The access token carries only `userId` and `role`. A role change (e.g. being made churchAdmin) only takes effect after the user refreshes or logs in again.

---

## 3. How auth works

Every protected endpoint needs `Authorization: Bearer <accessToken>`.

1. `POST /v1/auth/register` or `POST /v1/auth/login` returns `{ accessToken, refreshToken, sessionId }`. **Store all three.**
2. The **access token** lasts **`ACCESS_TTL`** (`.env`, e.g. `15m`). It carries the user's id and role.
3. When a request fails with `401`, call `POST /v1/auth/refresh-token` with the stored refresh token. You get a **new accessToken and a new refreshToken**. The old refresh token is invalidated the moment it is used (rotation), so always save the new one. Using the old one again returns `401 "Invalid refresh token"`.
4. The **refresh token** is valid for **`REFRESH_TTL`** (`.env`, e.g. `30d`; falls back to 30 days if that value isn't a plain `<number><s|m|h|d>` string), and that window restarts every time it is used.
5. Refresh does **not** return `sessionId`. Keep the one from login/register; you need it for logout.
6. **`deviceId`**: generate a random UUID once per app install, store it, and send the same value on every register/login. Logging in again on the same `deviceId` replaces that device's previous session, so the previous refresh token stops working.
7. **Logout** (`POST /v1/auth/logout`, logged-in) takes `{ sessionId }`, deletes that session and returns an empty body. The access token already issued stays valid until it expires, so just discard it on the client. A `sessionId` that does not belong to you is silently ignored.
8. **Change password** (`POST /v1/auth/change-password`, logged-in) immediately revokes **every** session for that user (all devices logged out), so expect the next request to 401 and require a fresh login.
9. **Roles** are `user`, `churchAdmin`, `superAdmin`. Registration always creates `user`.

---

## 4. Auth endpoints (`/v1/auth`)

| Method | Path | Guard | Throttle | Body | Success | Errors |
|---|---|---|---|---|---|---|
| POST | `/auth/register` | public | 5/min | `username` string, non-empty · `email` valid email · `password` string, 8–72 chars · `homeInstitutionId` 24-hex id · `rite` `"orthodox"` · `deviceId` string, non-empty | `201` `{ accessToken, refreshToken, sessionId }` | `409 "Email already registered, try logging in instead"` |
| POST | `/auth/login` | public | 10/min | `email` valid email · `password` string, non-empty · `deviceId` string, non-empty | `201` `{ accessToken, refreshToken, sessionId }` | `401 "Invalid credentials"` |
| POST | `/auth/refresh-token` | public | 20/min | `refreshToken` string, non-empty | `201` `{ accessToken, refreshToken }` | `401` `"Invalid refresh token"`, `"Refresh token expired"` or `"User not found"` |
| POST | `/auth/logout` | logged-in | 20/min | `sessionId` 24-hex id | `201`, empty body | — |
| POST | `/auth/change-password` | logged-in | 5/min | `currentPassword` string, non-empty · `newPassword` string, 8–72 chars | `201` `{ "message": "Password changed. Please log in again." }` | `400 "Current password is incorrect"`; `400 "New password must be different from the current password"` |

Note that these POSTs return **201**, not 200. Throttle limits are per client IP, independent of the global 100/min limit.

`homeInstitutionId` must be a real institution id: fetch one from `GET /institutions` first (registration does not itself verify the institution exists — see item 7 in section 20).

---

## 5. Profile (`/v1/users/me`)

| Method | Path | Guard | Body | Response |
|---|---|---|---|---|
| GET | `/users/me` | logged-in | — | `{ id, username, email, role, rite, homeInstitutionId, managedInstitutionIds }` |
| PATCH | `/users/me` | logged-in | `username` string, 2–50 chars, optional · `homeInstitutionId` 24-hex id, optional | the updated profile, same shape as GET |

Note the profile object uses `id`, not `_id`, unlike every other response in this API (see item 11 in section 20). `managedInstitutionIds` is the list of institutions a `churchAdmin` administers; empty for a plain `user`. `PATCH` with `homeInstitutionId` returns `404` if that institution doesn't exist. An empty body (no fields) is accepted and just returns the current profile unchanged.

---

## 6. Institutions (`/v1/institutions`)

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
  "phone": "optional",
  "instagramUrl": "optional",
  "facebookUrl": "optional",
  "mapsUrl": "optional",
  "coverImage": "optional",
  "followerCount": 0,
  "createdAt": "…", "updatedAt": "…"
}
```
**Institution responses never include `admins`** except one endpoint — see "Needs confirmation" item 4. `location.coordinates` is **[longitude, latitude]**, which is the reverse of the usual "lat, lng" order.

### Endpoints
| Method | Path | Guard | Input | Response |
|---|---|---|---|---|
| GET | `/institutions` | public | optional query `name` (partial, case-insensitive regex), `type` (`church`/`monastery`), `rite` (`orthodox`); combinable | array of Institution objects |
| GET | `/institutions/nearby` | public | see section 7 | array of Institution objects, nearest first |
| GET | `/institutions/:id` | public | — | one Institution object; `404` if not found |
| POST | `/institutions` | **superAdmin** | body below | `201` the created Institution object |
| PATCH | `/institutions/:institutionId` | admin of institution | any of `name` (2–100 chars), `description` (≤2000 chars), `phone` (`+`? + 8–15 digits), `instagramUrl`/`facebookUrl`/`mapsUrl`/`coverImage` (URL), `maxAttendance` (int ≥1), `bufferMinutes` (int ≥0) | the updated Institution object |
| PATCH | `/institutions/:id/admins` | **superAdmin** | `{ userId }` string | the updated institution, **including `admins`** (see item 4) |
| DELETE | `/institutions/:id` | **superAdmin** | — | `200`, empty body |

**`POST /institutions` body**
| Field | Type / rule |
|---|---|
| `name` | string, non-empty (trimmed) |
| `type` | `"church"` or `"monastery"` |
| `rite` | `"orthodox"` |
| `maxAttendance` | integer ≥ 1, required |
| `bufferMinutes` | integer ≥ 0, optional (default 30) |
| `address` | string, optional. Geocoded (via Nominatim/OpenStreetMap) to coordinates and the English country name. |
| `town` | string, optional. Fallback when `address` is missing or cannot be resolved. Currently only `"Kousba"` is known (country `"Lebanon"`). |

At least one of `address` / `town` must resolve to a location, otherwise `400 "Could not resolve a location from the provided address or town."`. `currency` (`USD`) and `timezone` (`Asia/Beirut`) cannot be set through this endpoint — they're always these two values. A new institution starts with **no admins** and **no salons**.

**`PATCH /institutions/:institutionId`**: admin-editable fields only; `type`, `rite`, `currency`, `timezone`, `location`, `country`, `salons` cannot be changed here. Unsent fields are left untouched. `404` if the institution doesn't exist.

**`PATCH /institutions/:id/admins`**: assigns a user as churchAdmin of that institution and sets that user's `role` to `churchAdmin`. Errors: `404` institution or user not found; `400` if the user is a superAdmin, is already an admin of this institution, or the institution already has 5 admins. (`userId` in the body is only checked as a non-empty string, not as a valid id — see item 7.)

**`DELETE /institutions/:id`**: deletes the institution and, in the same transaction, its events, news, bookings, follows, recurring schedules and schedule exceptions; removes it from every admin's managed list and sets any admin who then manages nothing back to `role: "user"`. `404` if it does not exist.

---

## 7. Nearby search — `GET /v1/institutions/nearby` (public)

| Query param | Type | Notes |
|---|---|---|
| `lat` | number | required |
| `lng` | number | required |
| `maxDistance` | number, **metres** | optional, default `10000` |
| `rite` | string | optional, exact match (e.g. `orthodox`) |
| `includeAllCountries` | `"true"` | optional. **Only the exact string `true` counts**; anything else (or missing) is false. |

Results are sorted nearest first. **Country rule:** if the `lat`/`lng` you send fall inside Lebanon's bounding box (lat 33.0–34.7, lng 35.1–36.6), results are limited to institutions whose `country` is `"Lebanon"`, unless `includeAllCountries=true`. If the point is outside that box, no country filter is applied at all. The response is an array of Institution objects (no `admins`). It is an empty array when nothing matches. `lat`/`lng` are not validated (see item 8).

---

## 8. Salons (`/v1/institutions/:institutionId/salons`)

A salon is a bookable room within an institution, listed in that institution's `salons` array (section 6). There is no `GET` for salons directly — read them from the Institution object.

| Method | Path | Guard | Body | Response | Errors |
|---|---|---|---|---|---|
| POST | `/institutions/:institutionId/salons` | admin of institution | `name` string, 2–50 chars (trimmed) · `maxAttendance` integer ≥ 1 | `201` `{ _id, name, maxAttendance }` | `404` institution not found; `409 "A salon with this name already exists in this institution."` (case-insensitive) |
| PATCH | `/institutions/:institutionId/salons/:salonId` | admin of institution | `name` and/or `maxAttendance`, same rules, both optional | `{ _id, name, maxAttendance }` | `404` institution or salon not found; `409` duplicate name (same rule as create) |
| DELETE | `/institutions/:institutionId/salons/:salonId` | admin of institution | — | `200`, empty body | `404` institution or salon not found; `409 "This salon has active or pending bookings and cannot be deleted."` |

**Delete is blocked** if the salon has any `requested` or `approved` booking whose `endsAt` is still in the future. Past bookings (even if still marked `approved`) don't block deletion. Deleting a salon does **not** cancel or touch any booking — it only removes the salon from the institution; existing bookings that reference the deleted `salonId` are left as-is (orphaned).

---

## 9. Follows

| Method | Path | Guard | Response |
|---|---|---|---|
| POST | `/institutions/:institutionId/follow` | logged-in | `201` `{ _id, userId, institutionId, createdAt, updatedAt }`. Errors: `404` institution not found; `409 "Already following this institution"`. |
| DELETE | `/institutions/:institutionId/follow` | logged-in | `200` `{ "message": "Unfollowed successfully." }`. `404 "Not following this institution"`. |
| GET | `/users/me/follows` | logged-in | array of the Institution objects the user follows (no `admins`). `[]` if none. |

Following increments and unfollowing decrements the institution's `followerCount`. Followers are also who gets notified when that institution posts a new event (section 18).

---

## 10. Home feed — `GET /v1/institutions/:institutionId/home-feed` (public)

Returns an array of **at most 5** items, soonest first:

```json
[ { "label": "mass", "occursAt": "2026-10-08T11:00:00.000Z" },
  { "label": "Parish picnic", "occursAt": "2026-10-10T10:00:00.000Z" } ]
```

The list merges three sources for that institution:
1. The next occurrence of each recurring weekly schedule row (section 12) — cancelled dates removed, time-overridden dates adjusted by matching "cancel"/"override" schedule exceptions. `label` is the service type (`"mass"` or `"regular_prayer"`).
2. "Special" schedule exceptions in the next 30 days (section 13). `label` is the service type.
3. Events starting in the next 30 days (section 11). `label` is the event title.

Items carry only `label` and `occursAt`: no id and no item type, so the app cannot link an item back to its source record (see item 15).

> The feed decides "next occurrence" and "which day an exception covers" using the **server's** local time zone, not the institution's `timezone` field (see item 13).

---

## 11. Events

**Event object:** `{ _id, institutionId, title, description?, image?, startsAt, endsAt?, likeCount, createdAt, updatedAt }`. `likeCount` is always `0` (there is no like endpoint).

| Method | Path | Guard | Input | Response |
|---|---|---|---|---|
| GET | `/institutions/:institutionId/events` | public | optional query `from`, `to` (ISO dates, filter on `startsAt`; unvalidated) | array, soonest first, **all matching events including past ones** if `from`/`to` are omitted |
| GET | `/events` | public | query `search`? (title, partial/case-insensitive) · `institutionId`? (24-hex) · `from`?/`to`? (ISO) · `page` (int ≥1, default 1) · `limit` (int 1–50, default 20) | `{ items: Event[] (with `institutionId` populated to `{ _id, name }`), page, limit, total }` |
| GET | `/events/:id` | public | — | one Event; `404` if not found |
| POST | `/institutions/:institutionId/events` | admin of institution | `title` string non-empty · `startsAt` ISO date · `description` string? · `image` URL? · `endsAt` ISO date? | `201` the Event |
| PATCH | `/institutions/:institutionId/events/:id` | admin of institution | any of `title`, `description`, `image`, `startsAt`, `endsAt` (same rules, all optional) | the updated Event |
| DELETE | `/institutions/:institutionId/events/:id` | admin of institution | — | `{ "message": "Event deleted successfully." }` |

PATCH and DELETE return `404` if the event does not belong to that institution.

**`GET /events` (global search) defaults to upcoming only:** if `from` is omitted it defaults to **now**, not the epoch — past events are excluded unless you pass an explicit `from` in the past. This differs from the per-institution list above, which defaults to the epoch (includes everything) when `from`/`to` are omitted. `total` counts every match ignoring paging.

Creating an event notifies every follower of that institution (`type: "event_created"`) — see section 18. There is still no check that `endsAt` is after `startsAt` (item 12).

---

## 12. News

**News object:** `{ _id, institutionId, title, body, image?, publishedAt, likeCount, createdAt, updatedAt }`. `likeCount` is always `0`.

| Method | Path | Guard | Input | Response |
|---|---|---|---|---|
| GET | `/institutions/:institutionId/news` | public | optional query `from`, `to` (ISO dates, filter on `publishedAt`; unvalidated) | array, **newest first** |
| GET | `/news/:id` | public | — | one News item; `404` if not found |
| POST | `/institutions/:institutionId/news` | admin of institution | `title` string non-empty · `body` string non-empty · `image` URL? · `publishedAt` ISO date? (defaults to now) | `201` the News item |
| PATCH | `/institutions/:institutionId/news/:id` | admin of institution | any of `title`, `body`, `image`, `publishedAt` | the updated News item |
| DELETE | `/institutions/:institutionId/news/:id` | admin of institution | — | `{ "message": "News deleted successfully." }` |

There is no global `GET /news` search (unlike events) — only a by-id lookup and the per-institution list.

---

## 13. Recurring schedules (`/v1/institutions/:institutionId/schedules`)

A schedule is a weekly recurring service (e.g. "mass every Sunday at 09:30"). There is **at most one schedule per institution per `dayOfWeek`+`time`**; a duplicate returns `409`.

**Object:** `{ _id, institutionId, dayOfWeek, time, serviceType, createdAt, updatedAt }` (`startDate`/`endDate` fields exist on the schema but are never set or read by any endpoint).

| Field | Rule |
|---|---|
| `dayOfWeek` | integer 0–6, `0` = Sunday (matches JS `Date#getDay()`) |
| `time` | string `"HH:mm"`, 24-hour, validated by regex |
| `serviceType` | `"mass"` or `"regular_prayer"` |

| Method | Path | Guard | Input | Response | Errors |
|---|---|---|---|---|---|
| GET | `/institutions/:institutionId/schedules` | public | — | array, sorted by `dayOfWeek` then `time` | — |
| POST | `/institutions/:institutionId/schedules` | admin of institution | `dayOfWeek`, `time`, `serviceType`, all required | `201` the schedule | `404` institution not found; `409 "A schedule already exists for this institution on this day and time. Update it instead."` |
| PATCH | `/institutions/:institutionId/schedules/:id` | admin of institution | any of the three fields | the updated schedule | `404` not found; `409` same duplicate rule |
| DELETE | `/institutions/:institutionId/schedules/:id` | admin of institution | — | `{ "message": "Schedule deleted successfully." }` | `404` not found |

A schedule's occurrences feed the home feed (section 10); there's no endpoint to list a schedule's upcoming dates directly.

---

## 14. Schedule exceptions

An exception changes one day of an institution's schedule. **There is at most one exception per institution per date**; a second one for the same date returns `409 "An exception already exists for this institution on this date — update it instead."`.

**Object:** `{ _id, institutionId, date, action, time?, serviceType?, createdAt, updatedAt }`

| Field | Rule |
|---|---|
| `date` | ISO date |
| `action` | `"cancel"`, `"override"` or `"special"` |
| `time` | string `"HH:mm"`, 24-hour. **Required and format-validated** when `action` is `override` or `special`; if sent for `cancel` it is still format-validated. |
| `serviceType` | `"mass"` or `"regular_prayer"`. **Required** when `action` is `special`; still validated against the enum if sent otherwise. |

| Method | Path | Guard | Input | Response |
|---|---|---|---|---|
| GET | `/institutions/:institutionId/schedule-exceptions` | public | optional query `from`, `to` (ISO dates; unvalidated) | array |
| POST | `/institutions/:institutionId/schedule-exceptions` | admin of institution | `date`, `action` required; `time`, `serviceType` conditionally required (above) | `201` the exception |
| PATCH | `/institutions/:institutionId/schedule-exceptions/:id` | admin of institution | any of the four fields | the updated exception |
| DELETE | `/institutions/:institutionId/schedule-exceptions/:id` | admin of institution | — | `{ "message": "Schedule exception deleted successfully." }` |

On `PATCH`, the server re-checks the final row (after applying your changes) against the same `time`/`serviceType` requirements and returns `400` if it would end up invalid — e.g. switching `action` to `special` without ever having set a `serviceType`.

---

## 15. Bookings (weddings, baptisms, engagements, funerals)

### The flow
1. **A user requests** a wedding, baptism or engagement. The booking is created with `status: "requested"`.
2. **An admin of that institution approves or rejects it.** Only `requested` bookings can be approved or rejected.
3. **The user can cancel** their own booking while it is `requested` or `approved`. **An admin of the institution can also cancel** any booking (requested or approved) at that institution.
4. **Funerals are admin-only.** An admin creates one directly and it is stored as `approved` with `bookingType: "funeral"`. There is no request or approval step.

Statuses: `requested`, `approved`, `rejected`, `cancelled`.

### Where the booking happens: `salonId`
An institution has a main space (the **sanctuary**) plus optional **salons** (section 8). In a booking, **omitting `salonId` means the church sanctuary**. Sending a `salonId` books that salon. Capacity and conflicts are checked per space.

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
| GET | `/institutions/:institutionId/bookings` | admin of institution | optional query `status`, `from`, `to` (`from`/`to` filter on `startsAt`; unvalidated) | array, oldest `startsAt` first. Includes every user's bookings. |
| PATCH | `/institutions/:institutionId/bookings/:id/approve` | admin of institution | no body | the Booking with `status: "approved"` |
| PATCH | `/institutions/:institutionId/bookings/:id/reject` | admin of institution | no body | the Booking with `status: "rejected"` |
| PATCH | `/institutions/:institutionId/bookings/:id/cancel` | admin of institution | no body | the Booking with `status: "cancelled"` — admin cancel, any user's booking |
| PATCH | `/bookings/:id/cancel` | logged-in, **owner only** | no body | the Booking with `status: "cancelled"` — self cancel |
| GET | `/users/me/bookings` | logged-in | — | the caller's bookings, **newest `startsAt` first** |

### Rules the server enforces when a user requests a booking
Checked in this order; the first failure wins:
1. Institution not found: `404 "Institution not found"`.
2. `startsAt` is not before `endsAt`: `400 "Start time must be before end time"`.
3. `startsAt` is in the past: `400 "Start time cannot be in the past"`.
4. `salonId` given but not one of that institution's salons: `400 "Salon not found in this institution"`.
5. `headcount` above the space's capacity (the salon's `maxAttendance`, or the institution's `maxAttendance` for the sanctuary): `400 "Headcount exceeds maximum attendance of <N>"`.
6. Overlaps an **already approved** booking in the **same space**: `409 "Booking conflicts with existing booking"`.

**What counts as a conflict:** only `approved` bookings block a slot; two pending requests for the same slot can both exist. Each approved booking also reserves the institution's `bufferMinutes` (default 30) before its start and after its end. The check is per space: the sanctuary does not conflict with a salon, and two different salons do not conflict. Cancelling or rejecting frees the slot.

**Approve** re-runs the conflict check and returns `409` if another booking was approved for that space and time in the meantime. A booking that is not `requested` returns `400 "A booking that is <status> cannot be approved"` (and the same wording with "rejected" for reject). A booking id that does not exist, or belongs to a different institution, returns `404 "Booking not found"`.

**Admin cancel and self cancel use different error codes for the same situation:** cancelling a booking that is already `rejected` or `cancelled` is `409` from the admin endpoint but `400` from the owner endpoint (both: `"A booking that is <status> cannot be cancelled"`). Both return `404 "Booking not found"` if the id doesn't exist; the admin route additionally scopes to `institutionId` (wrong institution ⇒ `404`), the owner route scopes to `userId` (not your booking ⇒ `404`).

**Funerals** skip only the conflict check: an admin can create one over an existing approved booking, and that existing booking is **not** cancelled automatically. The past-start check above still applies to funerals too. Once a funeral exists, any new request overlapping it is rejected with `409`, and a pending request created earlier cannot be approved. `createFuneral` runs under the `AdminGuard`, so either a superAdmin or that institution's churchAdmin can create one — the `userId` on the resulting booking is whoever created it (see item 10).

**Approving, rejecting, or admin-cancelling a booking notifies its owner** (`type: "booking_status"`) — see section 18. Notification failures are logged but never fail the request.

Booking list filters (`status`, `from`, `to`) are not validated: an unknown `status` value returns `[]` rather than an error, and an unparsable `from`/`to` is passed straight to MongoDB.

---

## 16. Books / library (`/v1/books`)

A flat, global library — not scoped to an institution.

**Book object:** `{ _id, title, author?, prayerType?, description?, language, fileUrl, coverUrl?, createdAt, updatedAt }`. `language` defaults to `"ar"` if not sent.

| Method | Path | Guard | Input | Response |
|---|---|---|---|---|
| GET | `/books` | public | optional query `search` (matches `title` or `author`, partial/case-insensitive), `prayerType` (exact match) | array, sorted by `title` |
| GET | `/books/:id` | public | — | one Book; `404` if not found |
| POST | `/books` | **superAdmin** | `title` string non-empty · `fileUrl` URL, required · `author`/`prayerType`/`description`/`language` string?, `coverUrl` URL? | `201` the Book |
| PATCH | `/books/:id` | **superAdmin** | any of the create fields, all optional | the updated Book |
| DELETE | `/books/:id` | **superAdmin** | — | `{ "message": "Book deleted successfully." }` |

---

## 17. Quotes — `GET /v1/quotes/today` (public)

Returns one verse of the day: `{ book, chapter, verse, text }`. The same verse is returned all day and is picked deterministically from a fixed local list of verses by day-of-year (`dayOfYear % verses.length`), using the **server's local date**, not UTC — the verse can flip at local midnight rather than UTC midnight. `404 "No verses are available."` if the verse list is empty (not possible with the shipped data file). There is no history or "verse for a given date" endpoint.

---

## 18. Notifications (`/v1/notifications`, all logged-in)

**Notification object:** `{ _id, userId, type, title, body, refId?, read, createdAt }`. `type` is one of `"event_created"`, `"event_reminder"`, `"booking_reminder"`, `"booking_status"`. `refId`, when present, is the id of the event or booking the notification is about (the app must know which, from `type`, to build a deep link). Notifications older than 60 days are automatically deleted (TTL index).

| Method | Path | Input | Response |
|---|---|---|---|
| GET | `/notifications` | query `page` (int ≥1, default 1), `limit` (int 1–50, default 20) | `{ items: Notification[], page, limit, total }`, newest first |
| GET | `/notifications/unread-count` | — | `{ count }` |
| PATCH | `/notifications/read-all` | — | `{ modifiedCount }` — marks every unread notification for the caller as read |
| PATCH | `/notifications/:id/read` | — | the updated Notification, `read: true`. `404` if it doesn't exist or isn't yours |

### What creates a notification
- **Event created** (section 11): every follower of the institution, `type: "event_created"`.
- **Booking approved / rejected / admin-cancelled** (section 15): the booking's owner, `type: "booking_status"`.
- **Daily reminders** (BullMQ job, not an endpoint): once a day, every follower of an institution with an event starting the next calendar day (Asia/Beirut) gets one `event_reminder`, and the owner of every `approved` booking starting the next calendar day gets one `booking_reminder`. Each is sent at most once per event/booking (tracked by existing notifications of that type+`refId`).

All notification creation is best-effort: if it fails, the triggering request (creating the event, approving the booking, etc.) still succeeds and the error is only logged server-side.

---

## 19. Not built yet

- **Per-parish store.**
- **Payments** of any kind.
- **Likes** on events and news (`likeCount` is always 0).
- **Managing an institution's `admins`** beyond assigning one superAdmin-side (no endpoint to remove a specific admin — only deleting the whole institution clears them).
- **A global news search** (events have `GET /events`; news only has the per-institution list and by-id lookup).
- **Listing a schedule's own upcoming occurrences** directly (only the merged home feed exposes computed dates).

---

## 20. Needs confirmation

Things that look inconsistent or unclear in the code. They are listed here and not guessed.

1. **`PATCH /institutions/:id/admins` returns the full institution including `admins`.** It returns the saved document without removing `admins`, unlike every GET and unlike `PATCH /institutions/:institutionId`. It is superAdmin-only, but it contradicts "never includes `admins`".
2. **`assignAdminToInstitution`'s `userId`** (`PATCH /institutions/:id/admins` body) is only checked as a non-empty string, not as a 24-hex id. A malformed value is passed straight to `findById`/`new Types.ObjectId(...)` and likely produces a `500` rather than a clean `400`.
3. **Nearby search with missing or non-numeric `lat`/`lng`** is not validated; `Number(undefined)` is `NaN`. The resulting error response was not tested.
4. **Query filters are not validated** on several list endpoints: `status`/`from`/`to` on the bookings list (an unknown `status` returns `[]`; a bad date is passed to MongoDB unvalidated), `from`/`to` on events/news/schedule-exceptions lists, and `name` on `GET /institutions` (used directly as a case-insensitive regex — special characters in `name` are escaped first, so this one is actually safe against regex injection, just not type-validated).
5. **Deleting a salon does not touch existing bookings.** A booking already made for that salon (even an `approved` future one, if it somehow isn't caught by the blocking check) is left pointing at a `salonId` that no longer exists in the institution's `salons` array.
6. **One id is not pipe-validated:** `AssignAdminDto.userId` (see item 2). Every other id-shaped route parameter and DTO field seen in this pass does use `ParseMongoIdPipe` or `@IsMongoId()`.
7. **`register` does not verify `homeInstitutionId` exists.** Unlike `updateProfile`'s `homeInstitutionId` (which 404s on a missing institution), registration will happily create a user pointing at a non-existent institution id, as long as it's a well-formed 24-hex string.
8. **Home feed and schedule occurrence math use the server's local time zone**, not the institution's `timezone` field (e.g. `Asia/Beirut`). If the server runs in a different zone, "today"/"tomorrow" boundaries and next-occurrence calculations can be off by hours relative to the institution's actual local time. The BullMQ daily-reminders job is the one place that explicitly uses `Asia/Beirut` regardless of server time zone.
9. **Booking admin list has no user details.** `GET /institutions/:institutionId/bookings` returns `userId` only (no name or email) — same for the profile's self-service endpoints, which is the only place a name can be fetched (and only for yourself).
10. **A funeral's `userId` is whoever created it** (any admin of the institution), not a designated "owner" — so only that specific admin can self-cancel it via the owner-only `PATCH /bookings/:id/cancel` route, though any admin of the institution can cancel it via the admin cancel route.
11. **`GET/PATCH /users/me` return `id`, not `_id`.** Every other object in this API (institutions, bookings, events, news, salons, notifications…) uses Mongo's native `_id`.
12. **No check that an event's or news item's `endsAt`/`publishedAt` postdates its start.** Only bookings enforce `startsAt < endsAt` and a not-in-the-past `startsAt`.
13. **Quote of the day uses the server's local calendar day**, not UTC — see section 17.
