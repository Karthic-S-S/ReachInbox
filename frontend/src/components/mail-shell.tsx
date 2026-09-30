import { Link } from "@tanstack/react-router";
import { ChevronDown, Clock3, Menu, PenLine, Send } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui-button";
import { api, type SlackStatus, type UserAccount } from "@/lib/api";

export function MailShell({
  children,
  mailbox,
  total,
}: {
  children: ReactNode;
  mailbox: "scheduled" | "sent";
  total?: number | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<UserAccount | null>(null);
  const [slack, setSlack] = useState<SlackStatus | null>(null);
  const [slackError, setSlackError] = useState("");
  useEffect(() => {
    void api
      .currentUser()
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch(() => setUser(null));
    void api
      .slackStatus()
      .then(setSlack)
      .catch((error) => {
        setSlack(null);
        setSlackError(error instanceof Error ? error.message : "Slack status could not be loaded.");
      });
  }, []);
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("slack");
    if (result === "connected") setSlackError("Slack connected successfully.");
    if (result === "error") setSlackError("Slack connection could not be completed.");
  }, []);
  async function logout() {
    await api.logout().catch(() => undefined);
    window.location.assign("/login");
  }
  async function disconnectSlack() {
    setSlackError("");
    try {
      await api.disconnectSlack();
      setSlack({ connected: false });
    } catch (error) {
      setSlackError(error instanceof Error ? error.message : "Slack could not be disconnected.");
    }
  }
  return (
    <div className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[286px_minmax(0,1fr)]">
      <header className="flex h-16 items-center justify-between border-b border-border px-4 lg:hidden">
        <Link to="/mail" className="font-logo text-3xl text-foreground">
          ReachInbox
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation"
          onClick={() => setOpen((value) => !value)}
        >
          <Menu className="size-5" />
        </Button>
      </header>
      <aside
        className={`${open ? "flex" : "hidden"} fixed inset-x-0 top-16 z-20 flex-col border-b border-border bg-background p-4 lg:static lg:flex lg:min-h-screen lg:border-b-0 lg:border-r lg:px-3 lg:py-6`}
      >
        <Link to="/mail" className="mb-4 hidden px-3 font-logo text-4xl text-foreground lg:block">
          ReachInbox
        </Link>
        <button
          className="mb-3 flex w-full items-center gap-3 rounded-md bg-muted px-3 py-2.5 text-left"
          type="button"
        >
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt=""
              className="size-10 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="grid size-10 place-items-center rounded-full bg-avatar text-sm font-semibold text-primary-foreground">
              {user?.name?.slice(0, 1).toUpperCase() ?? "RI"}
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{user?.name ?? "Connected account"}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {user?.email ?? "Loading account…"}
            </span>
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
        <Button variant="ghost" className="mb-3 w-full" onClick={() => void logout()}>
          Log out
        </Button>
        {slack?.connected ? (
          <div className="mb-3 rounded-md bg-muted px-3 py-2 text-sm">
            <p className="font-medium">Slack connected</p>
            <p className="truncate text-xs text-muted-foreground">
              {slack.workspace?.name ?? "Workspace"}
            </p>
            <Button
              variant="ghost"
              className="mt-1 h-auto w-full py-1 text-xs"
              onClick={() => void disconnectSlack()}
            >
              Disconnect
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            className="mb-3 w-full"
            onClick={() => {
              window.location.href = api.slackConnectUrl();
            }}
          >
            Connect Slack
          </Button>
        )}
        {slackError && (
          <p role="alert" className="mb-3 px-3 text-xs text-destructive">
            {slackError}
          </p>
        )}
        <Button variant="outline" className="mb-7 w-full" onClick={() => setOpen(false)}>
          <Link to="/compose" className="flex w-full items-center justify-center gap-2">
            <PenLine className="size-4 lg:hidden" />
            Compose
          </Link>
        </Button>
        <p className="mb-1 px-3 text-xs font-medium uppercase text-subtle">Core</p>
        <nav className="space-y-1">
          <Link
            to="/mail"
            onClick={() => setOpen(false)}
            className={`flex h-11 items-center gap-3 rounded-md px-3 ${mailbox === "scheduled" ? "bg-primary-soft font-semibold" : "text-muted-foreground hover:bg-muted"}`}
          >
            <Clock3 className="size-5" />
            <span className="flex-1">Scheduled</span>
            {mailbox === "scheduled" && total !== undefined && (
              <span className="text-sm">{total}</span>
            )}
          </Link>
          <Link
            to="/sent"
            onClick={() => setOpen(false)}
            className={`flex h-11 items-center gap-3 rounded-md px-3 ${mailbox === "sent" ? "bg-primary-soft font-semibold" : "text-muted-foreground hover:bg-muted"}`}
          >
            <Send className="size-5" />
            <span className="flex-1">Sent</span>
            {mailbox === "sent" && total !== undefined && <span className="text-sm">{total}</span>}
          </Link>
        </nav>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
