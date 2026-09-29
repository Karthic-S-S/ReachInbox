import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
  head: () => ({
    meta: [
      { title: "ReachInbox Email Scheduler" },
      { name: "description", content: "Schedule and send personalized email campaigns." },
      { property: "og:title", content: "ReachInbox Email Scheduler" },
      { property: "og:description", content: "Schedule and send personalized email campaigns." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
