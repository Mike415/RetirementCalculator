import { ClerkProvider, useAuth, useUser } from "@clerk/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { trpc } from "./lib/trpc";
import "./index.css";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

if (!CLERK_PUBLISHABLE_KEY) {
  console.error("Missing VITE_CLERK_PUBLISHABLE_KEY environment variable");
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

// Module-level token getter — updated by TrpcTokenBridge on every render.
// The tRPC client is created once and calls this lazily on each request,
// so it always uses the latest Clerk session token without needing to
// recreate the client.
let _getToken: (() => Promise<string | null>) | null = null;

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      async headers() {
        if (_getToken) {
          try {
            const token = await _getToken();
            if (token) return { Authorization: `Bearer ${token}` };
          } catch {}
        }
        return {};
      },
    }),
  ],
});

/**
 * Bridges Clerk's useAuth getToken into the module-level _getToken ref
 * so the stable tRPC client always has access to the latest session token.
 */
function TrpcTokenBridge() {
  const { getToken } = useAuth();
  // Update on every render — Clerk may return a new function reference
  // after a session change, and we want the tRPC client to pick it up.
  _getToken = () => getToken() as Promise<string | null>;
  return null;
}

/**
 * SessionWatcher — watches Clerk's isSignedIn state and reacts to
 * sign-in / sign-out transitions without requiring a manual page refresh.
 *
 * Sign-in (false → true):
 *   Invalidates all tRPC queries so they refetch with the new auth token.
 *   This causes CloudSyncContext / PlannerContext to re-run their queries
 *   and pick up the user's cloud data automatically — no reload needed.
 *
 * Sign-out (true → false):
 *   Hard reload to clear all in-memory state cleanly (query cache, context
 *   state, localStorage keys) since invalidation alone can leave stale data.
 */
function SessionWatcher() {
  const { isSignedIn, isLoaded } = useUser();
  const utils = trpc.useUtils();
  const prevSignedIn = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    // Don't act until Clerk has finished loading
    if (!isLoaded) return;

    // First render: record initial state without any side effects
    if (prevSignedIn.current === undefined) {
      prevSignedIn.current = isSignedIn ?? false;
      return;
    }

    const wasSignedIn = prevSignedIn.current;
    const nowSignedIn = isSignedIn ?? false;
    prevSignedIn.current = nowSignedIn;

    // Signed in: invalidate all queries so the UI updates immediately
    if (!wasSignedIn && nowSignedIn) {
      console.log("[SessionWatcher] Sign-in detected — invalidating queries");
      utils.invalidate();
      return;
    }

    // Signed out: hard reload to clear all state cleanly
    if (wasSignedIn && !nowSignedIn) {
      console.log("[SessionWatcher] Sign-out detected — reloading");
      setTimeout(() => window.location.reload(), 300);
    }
  }, [isLoaded, isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <TrpcTokenBridge />
        <SessionWatcher />
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  </ClerkProvider>
);
