/**
 * Minimal in-memory rate limiter — no extra dependency needed.
 * Keyed by IP + the email being attempted, so one abusive client can't lock
 * out other users, but repeated guesses against one account (e.g. the
 * doctor's login) get slowed down hard.
 *
 * Good enough for a single-process deployment. If this ever runs behind a
 * load balancer with multiple instances, swap this for a shared store
 * (e.g. Redis) so limits are enforced across all instances.
 */
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 8;

const attempts = new Map(); // key -> { count, windowStart }

function loginRateLimit(req, res, next) {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const key = `${req.ip}:${email}`;
  const now = Date.now();

  const entry = attempts.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: now });
    return next();
  }

  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    const retryAfterSec = Math.ceil((entry.windowStart + WINDOW_MS - now) / 1000);
    res.set('Retry-After', String(retryAfterSec));
    return res.status(429).json({ ok: false, error: 'Too many login attempts. Please try again later.' });
  }
  return next();
}

// Clear an entry on a successful login so a legitimate user who mistyped a
// few times isn't stuck waiting out the window.
function clearRateLimit(req) {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  attempts.delete(`${req.ip}:${email}`);
}

module.exports = { loginRateLimit, clearRateLimit };
