# ReachInbox API

Express, Prisma, BullMQ, and Ethereal SMTP foundation. It exposes health checks plus a development-only test queue endpoint.

```sh
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev
```

Copy `.env.example` to `.env` before database commands. Configure the root `.env` and backend `.env` with matching local credentials, then start MySQL and Redis from the repository root with `docker compose up -d`. Prisma uses the pre-provisioned `reachinbox_shadow` database for development migrations.

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` with Ethereal SMTP credentials in the local `.env`. Start the API with `npm run dev` and the separate mail worker with `npm run worker`. In development, `POST /api/test/queue` accepts `to`, `subject`, `text`, and optional `delayMs`; successful worker logs include the Ethereal preview URL.
