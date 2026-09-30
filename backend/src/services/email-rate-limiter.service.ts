import { env } from "../config/env.js";
import { rateLimitRedis } from "../config/rate-limit-redis.js";

const HOURLY_KEY_PREFIX = "reachinbox:email-rate:hour:";
const SENDER_HOURLY_KEY_PREFIX = "reachinbox:email-rate:sender:hour:";
const LAST_SEND_KEY = "reachinbox:email-rate:last-send-at";
const HOUR_MS = 60 * 60 * 1_000;

const reserveSendSlotScript = `
local now = tonumber(ARGV[1])
local minDelay = tonumber(ARGV[2])
local globalMaxPerHour = tonumber(ARGV[3])
local senderMaxPerHour = tonumber(ARGV[4])
local hourMs = tonumber(ARGV[5])
local hourBucket = math.floor(now / hourMs)
local globalHourKey = KEYS[1] .. hourBucket
local senderHourKey = KEYS[3] .. hourBucket
local hourEnd = (hourBucket + 1) * hourMs
local globalCount = tonumber(redis.call("GET", globalHourKey) or "0")

if globalCount >= globalMaxPerHour then
  return {0, hourEnd, 2}
end

if senderMaxPerHour > 0 then
  local senderCount = tonumber(redis.call("GET", senderHourKey) or "0")
  if senderCount >= senderMaxPerHour then
    return {0, hourEnd, 3}
  end
end

local lastSendAt = tonumber(redis.call("GET", KEYS[2]) or "0")
local nextEligibleAt = lastSendAt + minDelay
if nextEligibleAt > now then
  return {0, nextEligibleAt, 1}
end

redis.call("INCR", globalHourKey)
redis.call("PEXPIREAT", globalHourKey, hourEnd + hourMs)
if senderMaxPerHour > 0 then
  redis.call("INCR", senderHourKey)
  redis.call("PEXPIREAT", senderHourKey, hourEnd + hourMs)
end
redis.call("SET", KEYS[2], now, "PX", math.max(minDelay * 2, hourMs))
return {1, now, 0}
`;

export type EmailRateLimitDecision =
  | { allowed: true }
  | { allowed: false; nextEligibleAt: Date; reason: "MIN_DELAY" | "HOURLY_LIMIT"; hourlyLimit?: number };

export async function reserveEmailSendSlot(input: { senderId: string; senderHourlyLimit: number | null }): Promise<EmailRateLimitDecision> {
  const now = Date.now();
  const hourBucket = Math.floor(now / HOUR_MS);
  const senderLimit = input.senderHourlyLimit ?? 0;
  const result = (await rateLimitRedis.eval(
    reserveSendSlotScript,
    3,
    HOURLY_KEY_PREFIX,
    LAST_SEND_KEY,
    `${SENDER_HOURLY_KEY_PREFIX}${input.senderId}:`,
    now,
    env.MIN_DELAY_BETWEEN_EMAILS_MS,
    env.MAX_EMAILS_PER_HOUR,
    senderLimit,
    HOUR_MS,
  )) as [number, number, number];
  const [allowed, nextEligibleAt, limitReason] = result.map(Number) as [number, number, number];

  if (allowed === 1) return { allowed: true };

  const hourlyLimit = limitReason === 3 ? senderLimit : env.MAX_EMAILS_PER_HOUR;

  return {
    allowed: false,
    nextEligibleAt: new Date(nextEligibleAt),
    reason: nextEligibleAt >= (hourBucket + 1) * HOUR_MS ? "HOURLY_LIMIT" : "MIN_DELAY",
    ...(limitReason === 2 || limitReason === 3 ? { hourlyLimit } : {}),
  };
}
