import { Link } from "@tanstack/react-router";
import { Filter, RefreshCw, Search, Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, type MailboxKind, type MailSummary } from "@/lib/api";
import { Button } from "@/components/ui-button";
import { MailShell } from "@/components/mail-shell";

function displayDate(mail: MailSummary, mailbox: MailboxKind) {
  return mailbox === "scheduled" ? mail.scheduledAt : (mail.sentAt ?? "Sent");
}

export function MailList({ mailbox }: { mailbox: MailboxKind }) {
  const [items, setItems] = useState<MailSummary[]>([]);
  const [total, setTotal] = useState<number>();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    api
      .listMail(mailbox, controller.signal)
      .then((response) => {
        setItems(response.items);
        setTotal(response.total);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setItems([]);
        setTotal(undefined);
        setError(reason instanceof Error ? reason.message : "The mailbox could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [mailbox, refreshKey]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return items;
    return items.filter((mail) =>
      [mail.recipientName, mail.recipientEmail, mail.subject, mail.preview]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [items, query]);

  const emptyLabel = mailbox === "scheduled" ? "No scheduled emails yet." : "No sent emails yet.";

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
        {!loading && !error && filteredItems.length === 0 && (
          <p className="py-8 text-sm text-muted-foreground">
            {query ? "No emails match your search." : emptyLabel}
          </p>
        )}
        {!loading &&
          !error &&
          filteredItems.map((mail) => (
            <Link
              key={mail.id}
              to="/message/$messageId"
              params={{ messageId: mail.id }}
              className="grid min-h-17 grid-cols-[1fr_auto] items-center gap-3 border-b border-border py-3 sm:grid-cols-[220px_auto_minmax(0,1fr)_auto] sm:px-6"
            >
              <span className="font-medium">To: {mail.recipientName}</span>
              <span
                className={`hidden rounded-full border px-2 py-1 text-xs sm:inline ${mailbox === "scheduled" ? "border-schedule-border bg-schedule text-schedule-foreground" : "border-border bg-muted text-muted-foreground"}`}
              >
                {displayDate(mail, mailbox)}
              </span>
              <span className="col-span-2 min-w-0 truncate text-sm sm:col-span-1 sm:text-base">
                <strong className="font-semibold">{mail.subject}</strong>
                <span className="text-muted-foreground"> &nbsp;-&nbsp; {mail.preview}</span>
              </span>
              <Star className="hidden size-5 text-subtle sm:block" />
            </Link>
          ))}
      </div>
    </MailShell>
  );
}
