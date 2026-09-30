import { env } from "../config/env.js";
import { rateLimitRedis } from "../config/rate-limit-redis.js";

const HOURLY_KEY_PREFIX = "reachinbox:email-rate:hour:";
const LAST_SEND_KEY = "reachinbox:email-rate:last-send-at";
const HOUR_MS = 60 * 60 * 1_000;

const reserveSendSlotScript = `
local now = tonumber(ARGV[1])
local minDelay = tonumber(ARGV[2])
local maxPerHour = tonumber(ARGV[3])
local hourMs = tonumber(ARGV[4])
local hourBucket = math.floor(now / hourMs)
local hourKey = KEYS[1] .. hourBucket
local hourEnd = (hourBucket + 1) * hourMs
local count = tonumber(redis.call("GET", hourKey) or "0")

if count >= maxPerHour then
  return {0, hourEnd}
end

local lastSendAt = tonumber(redis.call("GET", KEYS[2]) or "0")
local nextEligibleAt = lastSendAt + minDelay
if nextEligibleAt > now then
  return {0, nextEligibleAt}
end

redis.call("INCR", hourKey)
redis.call("PEXPIREAT", hourKey, hourEnd + hourMs)
redis.call("SET", KEYS[2], now, "PX", math.max(minDelay * 2, hourMs))
return {1, now}
`;

export type EmailRateLimitDecision =
  | { allowed: true }
  | { allowed: false; nextEligibleAt: Date; reason: "MIN_DELAY" | "HOURLY_LIMIT" };

export async function reserveEmailSendSlot(): Promise<EmailRateLimitDecision> {
  const now = Date.now();
  const hourBucket = Math.floor(now / HOUR_MS);
  const result = (await rateLimitRedis.eval(
    reserveSendSlotScript,
    2,
    HOURLY_KEY_PREFIX,
    LAST_SEND_KEY,
    now,
    env.MIN_DELAY_BETWEEN_EMAILS_MS,
    env.MAX_EMAILS_PER_HOUR,
    HOUR_MS,
  )) as [number, number];
  const [allowed, nextEligibleAt] = result.map(Number) as [number, number];

  if (allowed === 1) return { allowed: true };

  return {
    allowed: false,
    nextEligibleAt: new Date(nextEligibleAt),
    reason: nextEligibleAt >= (hourBucket + 1) * HOUR_MS ? "HOURLY_LIMIT" : "MIN_DELAY",
  };
}
