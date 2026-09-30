# ReachInbox Email Scheduler

Phase 1-7 foundation for the ReachInbox email-scheduling assignment.

## Structure

- `frontend/`: React, TypeScript, and Tailwind application.
- `backend/`: Express, TypeScript, MySQL, and Prisma API foundation.
- `docker-compose.yml`: local MySQL, Redis, and Elasticsearch services.

## Local setup

```sh
docker compose up -d
cd backend
copy .env.example .env
npm install
npm run prisma:migrate -- --name init
npm run dev
```

`GET /api/health` verifies the API process. `GET /api/health/database` verifies the MySQL connection.

For Prisma development migrations, MySQL also provisions a dedicated `reachinbox_shadow` database. Set matching values in the root `.env` and `backend/.env` files before the first `docker compose up`.

Redis is available on the port configured by `REDIS_PORT`. Start the BullMQ worker separately with `npm run worker` from `backend/`. Configure the `SMTP_*` variables in `backend/.env` with local Ethereal credentials. The persistent scheduling endpoint is `POST /api/emails/schedule`; development-only SMTP checks remain available at `POST /api/test/queue`.

Scheduled delivery uses deterministic BullMQ job IDs and a database claim to prevent obvious duplicate sends. This is not an exactly-once SMTP guarantee: a worker can still crash after SMTP accepts a message but before MySQL records it as sent.

Before SMTP, every worker makes a shared Redis throttling reservation. `MIN_DELAY_BETWEEN_EMAILS_MS` and `MAX_EMAILS_PER_HOUR` control the global delivery cadence and hourly capacity; a throttled email remains scheduled and its existing BullMQ job is delayed rather than dropped or failed.

MySQL remains the source of truth for scheduling and delivery. Elasticsearch is a rebuildable search index exposed through `GET /api/emails/search`.

## Queue dashboard

With `BULL_BOARD_ENABLED=true`, Bull Board is available at `http://localhost:3000/admin/queues`. The application defaults the route to disabled when the variable is absent, while `backend/.env.example` enables it for local development. It displays the real BullMQ `emailQueue` through the same Redis connection used by the API and worker, including waiting, active, delayed, completed, and failed jobs.

This is an administrative development endpoint. Set `BULL_BOARD_ENABLED=false` to leave the route unavailable, and add application authentication or network controls before exposing it in production. No custom destructive queue APIs are added.
