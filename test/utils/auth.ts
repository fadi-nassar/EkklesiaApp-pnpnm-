import 'dotenv/config';
import { createHmac } from 'crypto';

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Builds a real HS256 access token the running server will accept, signed
// with the same JWT_ACCESS_SECRET it reads from .env (loaded above the same
// way @nestjs/config does for the server process). This replaces exercising
// POST /auth/register or /auth/login for every fixture user: those routes
// are aggressively throttled (5/min and 10/min per IP — see auth.controller.ts),
// a budget a multi-file integration suite blows through in seconds since
// every spec file shares one server process and one client IP. The actual
// auth flow has its own coverage; these tests are about bookings, salons,
// institutions and notifications, so fixture users skip straight to a valid
// token the same way AuthService.login() would produce one.
export function signAccessToken(userId: string, role: string): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET is not set (expected it from .env)');
  }
  const header = { alg: 'HS256', typ: 'JWT' };
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload = { sub: userId, role, iat: nowSeconds, exp: nowSeconds + 3600 };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = base64url(createHmac('sha256', secret).update(unsigned).digest());
  return `${unsigned}.${signature}`;
}

export function authHeader(token: string): [string, string] {
  return ['Authorization', `Bearer ${token}`];
}
