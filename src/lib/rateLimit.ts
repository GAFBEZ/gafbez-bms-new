import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

/**
 * Rate limiting for this app's own /login page (staff sign-in and
 * password reset, used as a direct fallback alongside the unified
 * website login). Backed by Upstash Redis so counts are shared across
 * every serverless instance -- an in-memory counter would not be, since
 * Vercel can route consecutive requests to different instances with no
 * shared memory. Mirrors the website repo's src/lib/rateLimit.ts; the
 * same Upstash database can back both apps since the key prefixes below
 * are namespaced separately from that repo's.
 *
 * If UPSTASH_REDIS_REST_URL/TOKEN are unset (e.g. local dev), rate
 * limiting is simply disabled (fails open) rather than breaking login
 * for every contributor who hasn't set up Upstash. Same fail-open
 * behavior applies if Redis is reachable but errors on a given call --
 * a rate limiter outage should never lock real staff out of the BMS.
 */
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
    : null;

function makeLimiter(tokens: number, window: Parameters<typeof Ratelimit.slidingWindow>[1], prefix: string) {
  if (!redis) return null;
  return new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(tokens, window), prefix, analytics: false });
}

const loginIpLimiter = makeLimiter(8, "1 m", "rl:bms:login:ip");
const loginEmailLimiter = makeLimiter(5, "15 m", "rl:bms:login:email");
const resetIpLimiter = makeLimiter(5, "10 m", "rl:bms:reset:ip");
const resetEmailLimiter = makeLimiter(3, "10 m", "rl:bms:reset:email");

async function checkLimiter(limiter: Ratelimit | null, key: string): Promise<boolean> {
  if (!limiter) return true;
  try {
    const { success } = await limiter.limit(key);
    return success;
  } catch (error) {
    console.error("[rateLimit] check failed, failing open:", error);
    return true;
  }
}

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

export async function checkLoginRateLimit(email: string): Promise<boolean> {
  const ip = await getClientIp();
  const [ipOk, emailOk] = await Promise.all([
    checkLimiter(loginIpLimiter, ip),
    checkLimiter(loginEmailLimiter, email || "unknown"),
  ]);
  return ipOk && emailOk;
}

export async function checkPasswordResetRateLimit(email: string): Promise<boolean> {
  const ip = await getClientIp();
  const [ipOk, emailOk] = await Promise.all([
    checkLimiter(resetIpLimiter, ip),
    checkLimiter(resetEmailLimiter, email || "unknown"),
  ]);
  return ipOk && emailOk;
}
