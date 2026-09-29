# ReachInbox Email Scheduler

Phase 1 monorepo for the ReachInbox email-scheduling assignment.

## Structure

- `frontend/`: React, TypeScript, and Tailwind application.
- `backend/`: Express, TypeScript, MySQL, and Prisma API foundation.
- `docker-compose.yml`: local MySQL service only.

## Local setup

```sh
docker compose up -d mysql
cd backend
copy .env.example .env
npm install
npm run prisma:migrate -- --name init
npm run dev
```

`GET /api/health` verifies the API process. `GET /api/health/database` verifies the MySQL connection.

For Prisma development migrations, MySQL also provisions a dedicated `reachinbox_shadow` database. Set matching values in the root `.env` and `backend/.env` files before the first `docker compose up`.

Redis is available on the port configured by `REDIS_PORT`. Start the BullMQ test worker separately with `npm run worker` from `backend/`.
