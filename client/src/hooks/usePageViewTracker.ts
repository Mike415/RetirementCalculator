/**
 * usePageViewTracker — fires analytics.trackPageView on every route change.
 * Uses a stable anonymous sessionId stored in localStorage.
 */
import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

function getOrCreateSessionId(): string {
  const key = "pr_session_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    localStorage.setItem(key, id);
  }
  return id;
}

export function usePageViewTracker(path: string) {
  const trackMutation = trpc.analytics.trackPageView.useMutation();

  useEffect(() => {
    const sessionId = getOrCreateSessionId();
    trackMutation.mutate({ sessionId, path });
    // Only fire when path changes — intentionally exclude trackMutation from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
}
