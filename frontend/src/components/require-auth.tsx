import { type ReactNode, useEffect, useState } from "react";
import { api } from "@/lib/api";

export function RequireAuth({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void api
      .currentUser()
      .then(() => setReady(true))
      .catch(() => window.location.replace("/login"));
  }, []);
  return ready ? (
    <>{children}</>
  ) : (
    <p className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
      Loading…
    </p>
  );
}
