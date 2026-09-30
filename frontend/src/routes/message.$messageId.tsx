import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { api, type EmailDetail } from "@/lib/api";

export const Route = createFileRoute("/message/$messageId")({
  component: () => (
    <RequireAuth>
      <MessagePage />
    </RequireAuth>
  ),
});

function MessagePage() {
  const { messageId } = Route.useParams();
  const [message, setMessage] = useState<EmailDetail>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void api
      .getEmail(messageId, controller.signal)
      .then(({ email }) => setMessage(email))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "The email could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [messageId]);
  const backTo = message?.status === "SENT" || message?.status === "FAILED" ? "/sent" : "/mail";
  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-8">
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link to={backTo} aria-label="Back to mail" className="shrink-0">
            <ArrowLeft className="size-7" />
          </Link>
          <h1 className="truncate text-2xl sm:text-3xl">{message?.subject ?? "Email message"}</h1>
        </div>
      </header>
      {loading && (
        <p className="mx-auto mt-10 max-w-5xl text-sm text-muted-foreground">Loading email...</p>
      )}
      {!loading && error && (
        <p role="alert" className="mx-auto mt-10 max-w-5xl text-sm text-destructive">
          {error}
        </p>
      )}
      {!loading && !error && message && (
        <article className="mx-auto mt-10 max-w-5xl">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-lg text-primary-foreground">
              S
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p>
                  <strong>Sender</strong> <span className="text-sm text-muted-foreground">—</span>
                </p>
                <time className="text-sm text-muted-foreground">
                  {message.sentAt ?? message.scheduledAt ?? ""}
                </time>
              </div>
              <span className="flex items-center gap-1 text-sm text-muted-foreground">
                to {message.recipientEmail} <ChevronDown className="size-3" />
              </span>
            </div>
          </div>
          <div className="ml-0 mt-8 space-y-6 text-lg leading-7 sm:ml-15">
            <div className="whitespace-pre-wrap">{message.htmlBody}</div>
            {message.failureReason && (
              <p className="text-sm text-destructive">{message.failureReason}</p>
            )}
          </div>
        </article>
      )}
    </main>
  );
}
