import { createFileRoute } from "@tanstack/react-router";
import { MailList } from "@/components/mail-list";
export const Route = createFileRoute("/sent")({
  head: () => ({
    meta: [
      { title: "Sent — ReachInbox Email Scheduler" },
      { name: "description", content: "Review email sent from ReachInbox Email Scheduler." },
      { property: "og:title", content: "Sent — ReachInbox Email Scheduler" },
      { property: "og:description", content: "Review email sent from ReachInbox Email Scheduler." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <MailList mailbox="sent" />,
});
