import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { api } from "@/lib/api";
export const Route = createFileRoute("/")({
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
  component: HomeRedirect,
});

function HomeRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    void api
      .currentUser()
      .then(() => navigate({ to: "/mail" }))
      .catch(() => navigate({ to: "/login" }));
  }, [navigate]);
  return (
    <p className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
      Loading…
    </p>
  );
}
