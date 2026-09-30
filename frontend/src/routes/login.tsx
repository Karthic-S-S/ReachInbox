import { createFileRoute } from "@tanstack/react-router";
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
        <p className="text-center text-sm text-subtle">
          Sign in with your Google account to manage your email schedule.
        </p>
      </section>
    </main>
  );
}
