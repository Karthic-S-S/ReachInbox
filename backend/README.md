# ReachInbox API

Phase 1 Express and Prisma foundation. It exposes `GET /api/health` and `GET /api/health/database` only.

```sh
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev
```

Copy `.env.example` to `.env` before database commands. Configure the root `.env` and backend `.env` with matching local credentials, then start MySQL from the repository root with `docker compose up -d mysql`. Prisma uses the pre-provisioned `reachinbox_shadow` database for development migrations.
