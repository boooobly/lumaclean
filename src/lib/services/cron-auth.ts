import {timingSafeEqual} from 'node:crypto';

/** Compare bytes: an untrusted Unicode header must never make timingSafeEqual throw. */
export function authorizedCron(request: Request, secret = process.env.CRON_SECRET) {
  if (!secret) return false;
  const actual = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
