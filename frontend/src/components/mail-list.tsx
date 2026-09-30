import { Link } from "@tanstack/react-router";
import { Filter, RefreshCw, Search, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type Email, type EmailStatus, type MailboxKind } from "@/lib/api";
import { Button } from "@/components/ui-button";
import { MailShell } from "@/components/mail-shell";

function displayDate(mail: Email, mailbox: MailboxKind) {
  const value = mailbox === "scheduled" ? mail.scheduledAt : mail.sentAt;
  return value ? new Date(value).toLocaleString() : "—";
}

export function MailList({ mailbox }: { mailbox: MailboxKind }) {
  const [items, setItems] = useState<Email[]>([]);
  const [total, setTotal] = useState<number>();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const search = query.trim();
    setLoading(true);
    setError("");
    const status: EmailStatus = mailbox === "scheduled" ? "SCHEDULED" : "SENT";
    const load = search
      ? api
          .searchEmails(search, status, controller.signal)
          .then((response) => ({ emails: response.data, total: response.pagination.total }))
      : api
          .listEmails(mailbox, controller.signal)
          .then((response) => ({ emails: response.emails, total: response.total }));
    void load
      .then((response) => {
        setItems(response.emails);
        setTotal(response.total);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setItems([]);
          setTotal(undefined);
          setError(reason instanceof Error ? reason.message : "The mailbox could not be loaded.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [mailbox, query, refreshKey]);
  const emptyLabel = query.trim()
    ? "No emails match your search."
    : mailbox === "scheduled"
      ? "No scheduled emails yet."
      : "No sent emails yet.";
  return (
    <MailShell mailbox={mailbox} total={total}>
      <div className="border-b border-border px-4 py-3 sm:px-7 lg:px-10">
        <div className="flex items-center gap-2">
          <label className="flex h-11 max-w-3xl flex-1 items-center gap-2 rounded-full bg-muted px-4 text-muted-foreground">
            <Search className="size-4" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="Search"
              aria-label="Search mail"
            />
          </label>
          <Button size="icon" variant="ghost" aria-label="Filter">
            <Filter className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Refresh mailbox"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={loading}
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>
      <div className="px-4 sm:px-7 lg:px-10">
        {loading && <p className="py-8 text-sm text-muted-foreground">Loading emails...</p>}
        {!loading && error && (
          <p role="alert" className="py-8 text-sm text-destructive">
            {error}
          </p>
        )}
        {!loading && !error && items.length === 0 && (
          <p className="py-8 text-sm text-muted-foreground">{emptyLabel}</p>
        )}
        {!loading &&
          !error &&
          items.map((mail) => (
            <Link
              key={mail.id}
              to="/message/$messageId"
              params={{ messageId: mail.id }}
              className="grid min-h-17 grid-cols-[1fr_auto] items-center gap-3 border-b border-border py-3 sm:grid-cols-[220px_auto_minmax(0,1fr)_auto] sm:px-6"
            >
              <span className="font-medium">To: {mail.recipientEmail}</span>
              <span className="hidden rounded-full border border-schedule-border bg-schedule px-2 py-1 text-xs text-schedule-foreground sm:inline">
                {mail.status} · {displayDate(mail, mailbox)}
              </span>
              <span className="col-span-2 min-w-0 truncate text-sm sm:col-span-1 sm:text-base">
                <strong className="font-semibold">{mail.subject}</strong>
              </span>
              <Star className="hidden size-5 text-subtle sm:block" />
            </Link>
          ))}
      </div>
    </MailShell>
  );
}
