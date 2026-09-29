# ReachInbox Email Scheduler

A React, TypeScript, and Tailwind frontend for scheduling and sending email through an Express API.

## Development

Install dependencies with Bun or npm, then run the development server:

```sh
bun install
bun run dev
```

Set `VITE_API_BASE_URL` to the Express API origin when the frontend and API are hosted separately. All backend communication is isolated in `src/lib/api.ts`.
