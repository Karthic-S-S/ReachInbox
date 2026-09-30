# ReachInbox API

Express, Prisma, BullMQ, Ethereal SMTP, and Elasticsearch email search. It exposes health checks, persistent email scheduling, read APIs, search, and a development-only test queue endpoint.

```sh
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev
```

Copy `.env.example` to `.env` before database commands. Configure the root `.env` and backend `.env` with matching local credentials, then start MySQL, Redis, and Elasticsearch from the repository root with `docker compose up -d`. Prisma uses the pre-provisioned `reachinbox_shadow` database for development migrations.

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` with Ethereal SMTP credentials in the local `.env`. Start the API with `npm run dev` and the separate mail worker with `npm run worker`.

`POST /api/emails/schedule` persists a campaign and its emails in MySQL before adding one delayed BullMQ job per email. `GET /api/emails/scheduled` returns scheduled or processing emails, and `GET /api/emails/sent` returns sent or failed emails. The worker conditionally changes only `SCHEDULED` records to `PROCESSING`, so a second worker cannot send the same record after it has been claimed. It sends only after that claim, then records either `SENT` with the provider message ID or `FAILED` with a delivery error.

MySQL and Redis cannot share one transaction. If BullMQ cannot accept the bulk enqueue after MySQL commits, the persisted records are changed to `FAILED` and the API returns an error rather than pretending they were scheduled. A future outbox/reconciliation phase can make that cross-store handoff recoverable. In development, `POST /api/test/queue` remains available for isolated SMTP checks; successful worker logs include the Ethereal preview URL.

## Delivery reliability

Each scheduled email uses the deterministic BullMQ job ID `email-<emailId>`; BullMQ custom IDs cannot contain colons. The worker atomically claims only `SCHEDULED` records and records `processingStartedAt` before SMTP. Jobs use the environment-controlled `EMAIL_JOB_ATTEMPTS` and exponential `EMAIL_JOB_BACKOFF_MS` policy. A non-final SMTP failure returns the record to `SCHEDULED` for BullMQ retry; the final failed attempt records `FAILED` with a sanitized reason.

Every claim also creates a delayed BullMQ recovery check. Once `PROCESSING_TIMEOUT_MS` has elapsed, the check returns an abandoned, non-active claim to `SCHEDULED` and re-enqueues its deterministic delivery job. It never resets a job that BullMQ still reports as active; instead it queues a uniquely identified next recovery check for the same lease, avoiding a race with an active worker while retaining crash recovery. This does not use cron or in-memory timers.

Database claims and deterministic jobs prevent duplicate processing when the database state is known, but ordinary SMTP has no atomic transaction with MySQL. If SMTP accepts a message and the worker crashes before writing `SENT`, recovery can eventually retry and a duplicate may be delivered. A true exactly-once guarantee requires provider-side idempotency or a transactional delivery mechanism.

## Shared throttling

`MIN_DELAY_BETWEEN_EMAILS_MS` defaults to `2000`, and `MAX_EMAILS_PER_HOUR` defaults to `200`. Before SMTP, every worker uses one Redis Lua script to atomically check the fixed hourly window and the last reserved send timestamp, then reserve capacity only when both permit it. The Redis keys are shared by all workers and instances, so concurrent workers cannot independently exceed the configured capacity.

When capacity is unavailable, the worker does not call SMTP or consume a BullMQ retry attempt. It conditionally restores its database claim from `PROCESSING` to `SCHEDULED`, updates `scheduledAt` to the next eligible timestamp, and moves the same deterministic BullMQ job back to delayed. This preserves the record and keeps it retryable. SMTP failures remain Phase 5 failures and use the normal retry policy; the rate-limit reservation is intentionally not released after an SMTP error because transport errors can be ambiguous about whether the provider accepted the message.

Jobs that become ready together are serialized by the shared minimum-delay reservation. BullMQ and concurrent workers do not promise strict global ordering, but jobs scheduled for the same sender/time normally retain queue order as they contend for the next shared slot. Unrelated senders also share the configured global safety limit in this phase.

For local throttle testing, temporarily start workers with small overrides such as `MIN_DELAY_BETWEEN_EMAILS_MS=2000` and `MAX_EMAILS_PER_HOUR=2`, then schedule three or more simultaneous emails. Two may reserve the current hourly window; remaining records stay `SCHEDULED` with an adjusted `scheduledAt` and delayed BullMQ jobs. Do not commit those temporary values to `.env`.

## Email search

MySQL is authoritative for email scheduling, state transitions, and delivery. Elasticsearch is a rebuildable `ELASTICSEARCH_INDEX` projection, defaulting to `emails`, used only for search. Local Compose runs Elasticsearch 8.19 on the configurable `ELASTICSEARCH_PORT` (default `9200`); the API uses `ELASTICSEARCH_URL` (default `http://localhost:9200`).

On startup, the API creates the index only when absent. The mapping uses `keyword` fields for identifiers and status, `text` plus `keyword` for the recipient, `text` for subject/body, and `date` fields for scheduling and audit timestamps. Existing indexes are never deleted during startup.

`GET /api/emails/search?q=welcome&status=SENT&page=1&limit=20` searches recipient, subject, and body with pagination capped at 100. `senderId` and `campaignId` are optional exact filters. A full email address uses the recipient keyword field for an exact result; regular terms use full-text matching. Responses return normalized email summaries, never raw Elasticsearch documents.

Scheduling indexes persisted records after queueing. Worker state transitions trigger best-effort index refreshes after MySQL is updated. Elasticsearch failures produce structured logs and never change MySQL email state, BullMQ retries, rate limiting, or SMTP delivery. This creates intentional eventual consistency: a document may be stale or absent during an outage. Recover with `npm run search:reindex`, which explicitly recreates the dedicated index from MySQL and reports indexed and failed counts. It is an administrator/development command, not a startup task or background scheduler.
