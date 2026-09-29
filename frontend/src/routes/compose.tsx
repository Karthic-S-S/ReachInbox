import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlignLeft,
  ArrowLeft,
  Bold,
  ChevronDown,
  Clock3,
  Italic,
  List,
  ListOrdered,
  Paperclip,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  Upload,
} from "lucide-react";
import { FormEvent, useRef, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui-button";

export const Route = createFileRoute("/compose")({
  head: () => ({
    meta: [
      { title: "Compose — ReachInbox Email Scheduler" },
      { name: "description", content: "Compose, personalize, and schedule a new email." },
      { property: "og:title", content: "Compose — ReachInbox Email Scheduler" },
      { property: "og:description", content: "Compose, personalize, and schedule a new email." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ComposePage,
});

const tools = [
  { label: "Undo", icon: Undo2 },
  { label: "Redo", icon: Redo2 },
  { label: "Bold", icon: Bold },
  { label: "Italic", icon: Italic },
  { label: "Underline", icon: Underline },
  { label: "Align", icon: AlignLeft },
  { label: "Numbered list", icon: ListOrdered },
  { label: "Bullet list", icon: List },
  { label: "Quote", icon: Quote },
  { label: "Strikethrough", icon: Strikethrough },
];

function ComposePage() {
  const attachmentRef = useRef<HTMLInputElement>(null);
  const recipientsRef = useRef<HTMLInputElement>(null);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [delay, setDelay] = useState("");
  const [limit, setLimit] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const addRecipient = () => {
    const value = recipientInput.trim().replace(/,$/, "");
    if (value && value.includes("@") && !recipients.includes(value))
      setRecipients((current) => [...current, value]);
    setRecipientInput("");
  };
  const payload = {
    recipients,
    subject,
    html: body,
    delaySeconds: Number(delay) || 0,
    hourlyLimit: Number(limit) || 0,
    attachmentIds: [] as string[],
    ...(scheduledAt ? { scheduledAt } : {}),
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (recipientInput) addRecipient();
    setSending(true);
    setError("");
    try {
      const uploaded = await Promise.all(attachments.map(api.uploadAttachment));
      const current = {
        ...payload,
        recipients:
          recipientInput && recipientInput.includes("@")
            ? [...recipients, recipientInput.trim()]
            : recipients,
        attachmentIds: uploaded.map((item) => item.id),
      };
      if (scheduledAt) await api.scheduleMail(current);
      else await api.sendMail(current);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The email could not be sent.");
    } finally {
      setSending(false);
    }
  }
  async function importList(file?: File) {
    if (!file) return;
    setError("");
    try {
      const result = await api.uploadRecipients(file);
      setRecipients(result.recipients);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "The recipient list could not be imported.",
      );
    }
  }
  return (
    <form onSubmit={submit} className="min-h-screen bg-background text-foreground">
      <header className="flex h-20 items-center justify-between border-t border-border px-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Link to="/mail" aria-label="Back to mail">
            <ArrowLeft className="size-7" />
          </Link>
          <h1 className="truncate text-2xl sm:text-3xl">Compose New Email</h1>
        </div>
        <div className="flex items-center gap-1">
          <input
            ref={attachmentRef}
            type="file"
            multiple
            hidden
            onChange={(event) => setAttachments(Array.from(event.target.files ?? []))}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Add attachment"
            onClick={() => attachmentRef.current?.click()}
          >
            <Paperclip className="size-6" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Choose send time"
            onClick={() => setScheduleOpen((value) => !value)}
          >
            <Clock3 className="size-6" />
          </Button>
          <Button type="submit" variant="outline" className="ml-2" disabled={sending}>
            {sending ? "Sending…" : scheduledAt ? "Send Later" : "Send"}
          </Button>
        </div>
      </header>
      <div className="relative mx-auto max-w-6xl px-4 pb-12 sm:px-8">
        {scheduleOpen && (
          <div className="absolute right-4 top-0 z-10 w-[min(350px,calc(100vw-2rem))] rounded-md border border-border bg-popover p-5 shadow-popover sm:right-8">
            <h2 className="mb-6 text-lg font-semibold">Send Later</h2>
            <label className="mb-4 block text-sm text-muted-foreground">
              Pick date &amp; time
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                className="mt-2 h-11 w-full border-b border-border bg-transparent text-foreground outline-none"
              />
            </label>
            {["Tomorrow, 10:00 AM", "Tomorrow, 11:00 AM", "Tomorrow, 3:00 PM"].map((time) => (
              <button
                key={time}
                type="button"
                className="block w-full py-2 text-left text-muted-foreground hover:text-foreground"
                onClick={() => {
                  const date = new Date();
                  date.setDate(date.getDate() + 1);
                  const hour = time.includes("3:00") ? 15 : Number(time.match(/\d+/)?.[0] ?? 10);
                  date.setHours(hour, 0, 0, 0);
                  setScheduledAt(date.toISOString().slice(0, 16));
                }}
              >
                {time}
              </button>
            ))}
            <div className="mt-14 flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setScheduleOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant="outline" onClick={() => setScheduleOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        )}
        <div className="grid gap-y-1 pt-3 sm:grid-cols-[70px_1fr] sm:gap-x-4">
          <label className="self-center py-3">From</label>
          <div className="flex h-12 w-fit items-center gap-3 rounded-md bg-muted px-3 text-lg text-muted-foreground">
            Connected account <ChevronDown className="size-4" />
          </div>
          <label className="self-center py-3">To</label>
          <div className="flex min-h-16 flex-wrap items-center gap-2 border-b border-border">
            <div className="flex flex-1 flex-wrap gap-2">
              {recipients.map((recipient) => (
                <button
                  type="button"
                  key={recipient}
                  className="rounded-full border border-primary bg-primary-soft px-3 py-1 text-sm"
                  onClick={() =>
                    setRecipients((current) => current.filter((item) => item !== recipient))
                  }
                >
                  {recipient}
                </button>
              ))}
              <input
                value={recipientInput}
                onChange={(event) => setRecipientInput(event.target.value)}
                onBlur={addRecipient}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    addRecipient();
                  }
                }}
                placeholder={recipients.length ? "" : "recipient@example.com"}
                className="min-w-48 flex-1 bg-transparent py-3 text-lg outline-none placeholder:text-subtle"
              />
            </div>
            <input
              ref={recipientsRef}
              type="file"
              accept=".csv,.txt"
              hidden
              onChange={(event) => void importList(event.target.files?.[0])}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => recipientsRef.current?.click()}
              className="text-primary"
            >
              <Upload className="size-4" />
              Upload List
            </Button>
          </div>
          <label className="self-center py-3">Subject</label>
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
            placeholder="Subject"
            className="h-16 border-b border-border bg-transparent px-3 text-lg outline-none placeholder:text-subtle"
          />
        </div>
        <div className="my-4 flex flex-wrap items-center gap-4 text-sm sm:ml-[86px] sm:text-base">
          <label>Delay between 2 emails</label>
          <input
            inputMode="numeric"
            value={delay}
            onChange={(event) => setDelay(event.target.value.replace(/\D/g, ""))}
            placeholder="00"
            className="h-12 w-20 rounded-md border border-border px-3 text-lg outline-none focus:border-primary"
          />
          <label className="ml-2">Hourly Limit</label>
          <input
            inputMode="numeric"
            value={limit}
            onChange={(event) => setLimit(event.target.value.replace(/\D/g, ""))}
            placeholder="00"
            className="h-12 w-20 rounded-md border border-border px-3 text-lg outline-none focus:border-primary"
          />
        </div>
        <div className="min-h-[420px] rounded-md bg-editor p-4">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
            placeholder="Type Your Reply..."
            className="h-12 w-full resize-none bg-transparent text-lg outline-none placeholder:text-subtle"
          />
          <div className="flex h-12 items-center gap-1 overflow-x-auto rounded-full bg-background px-2">
            {tools.map(({ label, icon: Icon }) => (
              <Button
                key={label}
                type="button"
                size="icon"
                variant="ghost"
                title={label}
                aria-label={label}
              >
                <Icon className="size-5" />
              </Button>
            ))}
          </div>
          {attachments.length > 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              {attachments.length} attachment{attachments.length === 1 ? "" : "s"} selected
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
