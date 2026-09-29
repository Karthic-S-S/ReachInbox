# ReachInbox API

Express, Prisma, BullMQ, and Ethereal SMTP foundation. It exposes health checks, persistent email scheduling, read APIs, and a development-only test queue endpoint.

```sh
npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run dev
```

Copy `.env.example` to `.env` before database commands. Configure the root `.env` and backend `.env` with matching local credentials, then start MySQL and Redis from the repository root with `docker compose up -d`. Prisma uses the pre-provisioned `reachinbox_shadow` database for development migrations.

Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM` with Ethereal SMTP credentials in the local `.env`. Start the API with `npm run dev` and the separate mail worker with `npm run worker`.

`POST /api/emails/schedule` persists a campaign and its emails in MySQL before adding one delayed BullMQ job per email. `GET /api/emails/scheduled` returns scheduled or processing emails, and `GET /api/emails/sent` returns sent or failed emails. The worker conditionally changes only `SCHEDULED` records to `PROCESSING`, so a second worker cannot send the same record after it has been claimed. It sends only after that claim, then records either `SENT` with the provider message ID or `FAILED` with a delivery error.

MySQL and Redis cannot share one transaction. If BullMQ cannot accept the bulk enqueue after MySQL commits, the persisted records are changed to `FAILED` and the API returns an error rather than pretending they were scheduled. A future outbox/reconciliation phase can make that cross-store handoff recoverable. In development, `POST /api/test/queue` remains available for isolated SMTP checks; successful worker logs include the Ethereal preview URL.
