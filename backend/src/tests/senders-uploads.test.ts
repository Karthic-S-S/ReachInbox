import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { SignJWT } from "jose";

process.env.GOOGLE_CLIENT_ID = "test-client.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
process.env.GOOGLE_CALLBACK_URL = "http://localhost:3000/api/auth/google/callback";
process.env.FRONTEND_URL = "http://localhost:3001";
process.env.AUTH_SESSION_SECRET = "this-is-a-test-session-secret-with-32-chars";

const { app } = await import("../app.js");
const { prisma } = await import("../config/prisma.js");

const testSuffix = Date.now().toString();
const userEmails = [`sender-a-${testSuffix}@example.invalid`, `sender-b-${testSuffix}@example.invalid`];
const signingKey = new TextEncoder().encode(process.env.AUTH_SESSION_SECRET);
let server: ReturnType<typeof app.listen>;
let baseUrl: string;
let userAId: string;
let userBId: string;
let userAToken: string;
let userBToken: string;

async function sessionToken(userId: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(signingKey);
}

async function request(path: string, token?: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (token) headers.set("Cookie", `reachinbox_session=${token}`);
  return fetch(`${baseUrl}${path}`, { ...init, headers });
}

function upload(content: string, filename: string, type: string) {
  const body = new FormData();
  body.append("file", new Blob([content], { type }), filename);
  return body;
}

before(async () => {
  const userA = await prisma.user.create({ data: { email: userEmails[0], name: "Sender test A" } });
  const userB = await prisma.user.create({ data: { email: userEmails[1], name: "Sender test B" } });
  userAId = userA.id;
  userBId = userB.id;
  userAToken = await sessionToken(userAId);
  userBToken = await sessionToken(userBId);
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
  await prisma.$disconnect();
});

test("sender CRUD is authenticated, user-owned, and omits secrets", async () => {
  const unauthenticated = await request("/api/senders");
  assert.equal(unauthenticated.status, 401);

  const created = await request("/api/senders", userAToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: `owner-${testSuffix}@example.com`, displayName: "Owner sender" }),
  });
  assert.equal(created.status, 201);
  const { sender } = await created.json() as { sender: { id: string; email: string; userId?: string; encryptedAccessToken?: string } };
  assert.equal(sender.email, `owner-${testSuffix}@example.com`);
  assert.equal("userId" in sender, false);
  assert.equal("encryptedAccessToken" in sender, false);

  const listed = await request("/api/senders", userAToken);
  assert.equal(listed.status, 200);
  assert.equal((await listed.json() as { senders: Array<{ id: string }> }).senders.some((item) => item.id === sender.id), true);

  const fetched = await request(`/api/senders/${sender.id}`, userAToken);
  assert.equal(fetched.status, 200);

  const updated = await request(`/api/senders/${sender.id}`, userAToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: "Updated owner sender", hourlySendLimit: 10 }),
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json() as { sender: { displayName: string; hourlySendLimit: number } }).sender.displayName, "Updated owner sender");

  for (const method of ["GET", "PATCH", "DELETE"] as const) {
    const response = await request(`/api/senders/${sender.id}`, userBToken, {
      method,
      ...(method === "PATCH" ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: "Forbidden" }) } : {}),
    });
    assert.equal(response.status, 404);
  }

  const deleted = await request(`/api/senders/${sender.id}`, userAToken, { method: "DELETE" });
  assert.equal(deleted.status, 204);
});

test("recipient upload parses CSV and plain text, deduplicates, and reports invalid input", async () => {
  const csv = await request("/api/uploads/recipients", userAToken, {
    method: "POST",
    body: upload(`email\nAlice@Example.com\nbob@example.com\nAlice@example.com\nnot-an-email`, "recipients.csv", "text/csv"),
  });
  assert.equal(csv.status, 200);
  assert.deepEqual(await csv.json(), { recipients: ["alice@example.com", "bob@example.com"], count: 2, invalid: ["not-an-email"] });

  const text = await request("/api/uploads/recipients", userAToken, {
    method: "POST",
    body: upload("carol@example.com\nCAROL@example.com\ndave@example.com", "recipients.txt", "text/plain"),
  });
  assert.equal(text.status, 200);
  assert.deepEqual(await text.json(), { recipients: ["carol@example.com", "dave@example.com"], count: 2, invalid: [] });

  const empty = await request("/api/uploads/recipients", userAToken, {
    method: "POST",
    body: upload("", "empty.csv", "text/csv"),
  });
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), { recipients: [], count: 0, invalid: [] });

  const missing = await request("/api/uploads/recipients", userAToken, { method: "POST", body: new FormData() });
  assert.equal(missing.status, 400);
  assert.equal((await missing.json() as { error: { code: string } }).error.code, "UPLOAD_REQUIRED");

  const unsupported = await request("/api/uploads/recipients", userAToken, {
    method: "POST",
    body: upload("image", "recipients.png", "image/png"),
  });
  assert.equal(unsupported.status, 400);

  const unauthenticated = await request("/api/uploads/recipients", undefined, {
    method: "POST",
    body: upload("someone@example.com", "recipients.txt", "text/plain"),
  });
  assert.equal(unauthenticated.status, 401);
});
