import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui-button";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — ReachInbox Email Scheduler" },
      {
        name: "description",
        content: "Sign in to manage scheduled and sent email in ReachInbox Email Scheduler.",
      },
      { property: "og:title", content: "Sign in — ReachInbox Email Scheduler" },
      {
        property: "og:description",
        content: "Sign in to manage scheduled and sent email in ReachInbox Email Scheduler.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  useEffect(() => {
    void api
      .currentUser()
      .then(() => navigate({ to: "/mail" }))
      .catch(() => undefined);
  }, [navigate]);
  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-10">
      <section className="w-full max-w-[530px] rounded-lg border border-border bg-card px-7 py-10 shadow-card sm:px-16 sm:py-14">
        <div className="mb-9 text-center">
          <div className="mb-3 font-logo text-3xl">ReachInbox</div>
          <h1 className="text-4xl font-semibold">Login</h1>
        </div>
        <Button
          type="button"
          variant="soft"
          className="mb-5 w-full"
          onClick={() => {
            window.location.href = api.googleLoginUrl();
          }}
        >
          <span className="font-bold text-google-blue">G</span> Login with Google
        </Button>
        <div className="mb-6 flex items-center gap-5 text-sm text-subtle">
          <span className="h-px flex-1 bg-border" />
          <span>or sign up through email</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <div className="space-y-3">
          <input
            disabled
            type="email"
            placeholder="Email ID"
            className="h-15 w-full rounded-md bg-muted px-5 text-muted-foreground outline-none disabled:cursor-not-allowed"
          />
          <input
            disabled
            type="password"
            placeholder="Password"
            className="h-15 w-full rounded-md bg-muted px-5 text-muted-foreground outline-none disabled:cursor-not-allowed"
          />
        </div>
        <Button
          disabled
          className="mt-7 w-full"
          title="Email/password authentication is not configured"
        >
          Login
        </Button>
        <p className="mt-3 text-center text-xs text-subtle">
          Email/password login is not available. Use Google to sign in.
        </p>
      </section>
    </main>
  );
}
