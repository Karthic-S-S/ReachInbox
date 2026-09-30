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

## Google OAuth authentication

Phase 9 uses the Google OAuth 2.0 authorization-code flow. It verifies Google's ID token on the backend, creates or loads the application user, and stores a short-lived signed JWT only in an HTTP-only cookie. Google access and refresh tokens are never sent to the browser or persisted by the application.

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select a project and configure its OAuth consent screen.
2. Create an **OAuth 2.0 Client ID** of type **Web application**.
3. Add the exact redirect URI in `GOOGLE_CALLBACK_URL`, for example `http://localhost:3000/api/auth/google/callback`. It must match the backend port exactly.
4. Add the frontend and backend localhost URLs to the authorized JavaScript origins when Google requests them, using the exact values used for `FRONTEND_URL` and the API origin.
5. Copy `backend/.env.example` to `backend/.env` and set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `FRONTEND_URL`, and a random `AUTH_SESSION_SECRET` (at least 32 characters). Never commit this file or credentials.

`AUTH_ENABLED=true` requires all Google and session settings and fails startup with a clear configuration error if any are missing. Set `AUTH_ENABLED=false` only for intentionally disabled local-auth development; protected APIs will still reject requests. In production, cookies are marked `Secure`; HTTPS is therefore required.

The API endpoints are `GET /api/auth/google`, `GET /api/auth/google/callback`, `GET /api/auth/me`, and `POST /api/auth/logout`. The callback state is a cryptographically random, short-lived HTTP-only cookie and is validated before exchanging the authorization code. If an existing local user has the same verified email and no Google identity, the account is deliberately linked to that Google subject; otherwise the unique Google subject prevents duplicate accounts.

Email scheduling, listings, individual email lookup, and Elasticsearch search require authentication and are filtered by the authenticated application user. The search index now includes user ownership; after applying this change to an existing Elasticsearch index, run `npm run search:reindex` to recreate it. BullMQ jobs continue to carry only email identifiers. Bull Board remains an administrative endpoint and is not changed by this phase.

## Slack OAuth rate-limit notifications

Phase 10 connects Slack through its real OAuth v2 flow. Create a Slack app, add the **OAuth & Permissions** scopes `chat:write` and `incoming-webhook`, then set its redirect URL to the exact `SLACK_REDIRECT_URI` (for example, `http://localhost:3000/api/slack/callback`). Copy the app client ID and client secret into `backend/.env`, along with a distinct `SLACK_TOKEN_ENCRYPTION_KEY` of at least 32 random characters. Do not commit any of these values.

An authenticated user starts the flow with `GET /api/slack/connect`. OAuth state is random, short-lived, stored in an HTTP-only signed cookie, and bound to that user’s authenticated session. The callback stores a single connection per application user. Slack bot tokens are AES-256-GCM encrypted before persistence and are never returned by APIs. `GET /api/slack/status` returns only connection/workspace metadata; `POST /api/slack/disconnect` deletes the user’s application connection.

When the global hourly send capacity is reached, the worker keeps the email scheduled and delayed as before. It makes a best-effort `chat.postMessage` request to the connected owner’s selected Slack incoming-webhook channel. Redis atomically permits at most one notification per user, sender, and affected hour window. Slack failures and disconnected users are safe no-ops: they are logged without tokens and never fail or unschedule the email job.
