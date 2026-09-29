import { createFileRoute, Link } from "@tanstack/react-router";
import { Archive, ArrowLeft, ChevronDown, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type MailMessage } from "@/lib/api";
import { Button } from "@/components/ui-button";

export const Route = createFileRoute("/message/$messageId")({
  head: () => ({
    meta: [
      { title: "Message — ReachInbox Email Scheduler" },
      { name: "description", content: "Read an email message in ReachInbox Email Scheduler." },
      { property: "og:title", content: "Message — ReachInbox Email Scheduler" },
      {
        property: "og:description",
        content: "Read an email message in ReachInbox Email Scheduler.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MessagePage,
});

function MessagePage() {
  const { messageId } = Route.useParams();
  const [message, setMessage] = useState<MailMessage>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    api
      .getMail(messageId, controller.signal)
      .then(setMessage)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : "The email could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [messageId]);

  const backTo = message?.status === "sent" ? "/sent" : "/mail";

  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-8">
      <header className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link to={backTo} aria-label="Back to mail" className="shrink-0">
            <ArrowLeft className="size-7" />
          </Link>
          <h1 className="truncate text-2xl sm:text-3xl">{message?.subject ?? "Email message"}</h1>
        </div>
        <div className="hidden items-center gap-1 sm:flex">
          <Button size="icon" variant="ghost" aria-label="Star">
            <Star className="size-5" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Archive">
            <Archive className="size-5" />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Delete">
            <Trash2 className="size-5" />
          </Button>
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
              {message.senderName.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p>
                  <strong>{message.senderName}</strong>{" "}
                  <span className="text-sm text-muted-foreground">
                    &lt;{message.senderEmail}&gt;
                  </span>
                </p>
                <time className="text-sm text-muted-foreground">
                  {message.sentAt ?? message.scheduledAt ?? ""}
                </time>
              </div>
              <button
                type="button"
                className="flex items-center gap-1 text-sm text-muted-foreground"
              >
                to {message.recipientEmail} <ChevronDown className="size-3" />
              </button>
            </div>
          </div>
          <div className="ml-0 mt-8 space-y-6 text-lg leading-7 sm:ml-15">
            <div dangerouslySetInnerHTML={{ __html: message.html }} />
            {message.attachments.length > 0 && (
              <div className="flex flex-wrap gap-4">
                {message.attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.url}
                    className="w-58 overflow-hidden rounded-md bg-muted p-3 hover:bg-accent"
                  >
                    <p className="truncate text-sm font-medium">{attachment.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.ceil(attachment.size / 1024)} KB
                    </p>
                  </a>
                ))}
              </div>
            )}
          </div>
        </article>
      )}
    </main>
  );
}
