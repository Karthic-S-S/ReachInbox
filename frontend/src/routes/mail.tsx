import { createFileRoute } from "@tanstack/react-router";
import { MailList } from "@/components/mail-list";
export const Route = createFileRoute("/mail")({
  head: () => ({
    meta: [
      { title: "Scheduled — ReachInbox Email Scheduler" },
      { name: "description", content: "Review and manage your scheduled emails." },
      { property: "og:title", content: "Scheduled — ReachInbox Email Scheduler" },
      { property: "og:description", content: "Review and manage your scheduled emails." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <MailList mailbox="scheduled" />,
});
