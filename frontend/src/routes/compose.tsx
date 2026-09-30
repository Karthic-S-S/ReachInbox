import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Clock3, Upload } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { api, type Sender } from "@/lib/api";
import { Button } from "@/components/ui-button";

export const Route = createFileRoute("/compose")({
  component: () => (
    <RequireAuth>
      <ComposePage />
    </RequireAuth>
  ),
});

function ComposePage() {
  const navigate = useNavigate();
  const recipientsRef = useRef<HTMLInputElement>(null);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [senderId, setSenderId] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [delay, setDelay] = useState("0");
  const [hourlyLimit, setHourlyLimit] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [uploadNotice, setUploadNotice] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [scheduling, setScheduling] = useState(false);
  useEffect(() => {
    void api
      .listSenders()
      .then(({ senders }) => {
        const active = senders.filter((sender) => sender.status === "ACTIVE");
        setSenders(active);
        setSenderId(active[0]?.id ?? "");
        setHourlyLimit(active[0]?.hourlySendLimit?.toString() ?? "");
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Senders could not be loaded."),
      );
  }, []);
  function addRecipient() {
    const value = recipientInput.trim().replace(/,$/, "").toLowerCase();
    if (value && !recipients.includes(value)) setRecipients((current) => [...current, value]);
    setRecipientInput("");
  }
  async function importList(file?: File) {
    if (!file) return;
    setError("");
    setUploadNotice("");
    try {
      const result = await api.uploadRecipients(file);
      setRecipients(result.recipients);
      setUploadNotice(
        `${result.count} valid recipient${result.count === 1 ? "" : "s"} detected.${result.invalid.length ? ` Invalid: ${result.invalid.join(", ")}` : ""}`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "The recipient list could not be imported.",
      );
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const finalRecipients = recipientInput.trim()
      ? [...recipients, recipientInput.trim().toLowerCase()]
      : recipients;
    const start = scheduledAt ? new Date(scheduledAt) : null;
    const delaySeconds = Number(delay);
    const parsedHourlyLimit = hourlyLimit.trim() === "" ? null : Number(hourlyLimit);
    if (
      !senderId ||
      !finalRecipients.length ||
      !subject.trim() ||
      !body.trim() ||
      !start ||
      Number.isNaN(start.getTime()) ||
      start.getTime() <= Date.now() ||
      !Number.isFinite(delaySeconds) ||
      delaySeconds < 0 ||
      (parsedHourlyLimit !== null &&
        (!Number.isInteger(parsedHourlyLimit) ||
          parsedHourlyLimit < 1 ||
          parsedHourlyLimit > 1_000_000))
    ) {
      setError(
        "Choose an active sender, at least one recipient, a subject, body, future schedule time, non-negative delay, and a valid hourly limit.",
      );
      return;
    }
    setScheduling(true);
    try {
      const selectedSender = senders.find((sender) => sender.id === senderId);
      if (selectedSender && selectedSender.hourlySendLimit !== parsedHourlyLimit) {
        const { sender } = await api.updateSender(senderId, { hourlySendLimit: parsedHourlyLimit });
        setSenders((current) => current.map((item) => (item.id === sender.id ? sender : item)));
      }
      const result = await api.scheduleEmails({
        senderId,
        recipients: finalRecipients,
        subject: subject.trim(),
        body: body.trim(),
        startTime: start.toISOString(),
        delayBetweenEmailsMs: Math.round(delaySeconds * 1000),
      });
      setSuccess(
        `${result.scheduledCount} email${result.scheduledCount === 1 ? "" : "s"} scheduled successfully.`,
      );
      setTimeout(() => void navigate({ to: "/mail" }), 700);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The emails could not be scheduled.");
    } finally {
      setScheduling(false);
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
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Choose schedule time"
            onClick={() => setScheduleOpen((value) => !value)}
          >
            <Clock3 className="size-6" />
          </Button>
          <Button
            type="submit"
            variant="outline"
            className="ml-2"
            disabled={scheduling || !senders.length}
          >
            {scheduling ? "Scheduling…" : "Schedule"}
          </Button>
        </div>
      </header>
      <div className="relative mx-auto max-w-6xl px-4 pb-12 sm:px-8">
        {scheduleOpen && (
          <div className="absolute right-4 top-0 z-10 w-[min(350px,calc(100vw-2rem))] rounded-md border border-border bg-popover p-5 shadow-popover sm:right-8">
            <h2 className="mb-3 text-lg font-semibold">Schedule email</h2>
            <label className="block text-sm text-muted-foreground">
              Pick date &amp; time
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(event) => setScheduledAt(event.target.value)}
                className="mt-2 h-11 w-full border-b border-border bg-transparent text-foreground outline-none"
              />
            </label>
            <div className="mt-6 flex justify-end">
              <Button type="button" variant="outline" onClick={() => setScheduleOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        )}
        <div className="grid gap-y-1 pt-3 sm:grid-cols-[70px_1fr] sm:gap-x-4">
          <label className="self-center py-3">From</label>
          <select
            value={senderId}
            onChange={(event) => {
              const nextSenderId = event.target.value;
              setSenderId(nextSenderId);
              setHourlyLimit(
                senders.find((sender) => sender.id === nextSenderId)?.hourlySendLimit?.toString() ??
                  "",
              );
            }}
            required
            className="h-12 max-w-lg rounded-md bg-muted px-3 text-lg text-foreground outline-none"
          >
            <option value="">
              {senders.length ? "Select sender" : "No active senders available"}
            </option>
            {senders.map((sender) => (
              <option key={sender.id} value={sender.id}>
                {sender.displayName ?? sender.email} ({sender.email})
              </option>
            ))}
          </select>
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
              accept=".csv,.txt,text/csv,text/plain"
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
        {!senders.length && (
          <p className="mt-4 text-sm text-destructive">
            An active sender is required before you can schedule email. Create one through the
            sender API before scheduling.
          </p>
        )}
        <div className="my-4 flex flex-wrap items-center gap-4 text-sm sm:ml-[86px] sm:text-base">
          <label>Delay between emails (seconds)</label>
          <input
            inputMode="numeric"
            value={delay}
            onChange={(event) => setDelay(event.target.value.replace(/[^\d.]/g, ""))}
            className="h-12 w-20 rounded-md border border-border px-3 text-lg outline-none focus:border-primary"
          />
          <label className="ml-2">Hourly limit (per sender)</label>
          <input
            inputMode="numeric"
            value={hourlyLimit}
            onChange={(event) => setHourlyLimit(event.target.value.replace(/[^\d]/g, ""))}
            placeholder="Server default"
            className="h-12 w-36 rounded-md border border-border px-3 text-lg outline-none focus:border-primary"
          />
          <span className="text-muted-foreground">
            Optional. The Redis-enforced server cap still applies.
          </span>
        </div>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          placeholder="Type Your Reply..."
          className="min-h-[420px] w-full rounded-md bg-editor p-4 text-lg outline-none placeholder:text-subtle"
        />
        {uploadNotice && <p className="mt-4 text-sm text-muted-foreground">{uploadNotice}</p>}
        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="mt-4 text-sm text-primary">
            {success}
          </p>
        )}
      </div>
    </form>
  );
}
