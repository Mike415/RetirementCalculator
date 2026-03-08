import { ClerkProvider, useAuth, useClerk } from "@clerk/react";
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
 * SessionWatcher — uses Clerk's low-level addListener() API to detect
 * when a session is newly established (e.g. after modal sign-in) and
 * performs a hard page reload.
 *
 * Why addListener instead of useSession?
 * addListener fires synchronously inside Clerk's internal state machine,
 * before React's render cycle. This means it reliably catches the session
 * change even when React's reconciler hasn't propagated the update yet.
 *
 * Why a hard reload?
 * Clerk v6 modal sign-in updates the internal session store, but React's
 * reconciler doesn't always flush the change synchronously across all
 * provider boundaries (PlannerContext, CloudSyncContext, etc.). A hard
 * reload is the only guaranteed way to ensure every part of the app
 * starts fresh with the correct auth context.
 *
 * The 500ms delay gives Clerk time to finish writing the session cookie
 * before the page reloads, preventing a race where the reload fires
 * before the cookie is available.
 */
function SessionWatcher() {
  const clerk = useClerk();
  const prevSessionId = useRef<string | null | undefined>(undefined);
  const reloadScheduled = useRef(false);

  useEffect(() => {
    // Wait until Clerk is loaded before subscribing
    if (!clerk.loaded) return;

    const unsubscribe = clerk.addListener(({ session }) => {
      const currentId = session?.id ?? null;

      // First emission: record initial state, don't reload
      if (prevSessionId.current === undefined) {
        prevSessionId.current = currentId;
        return;
      }

      // Session went from absent → present: user just signed in
      if (!prevSessionId.current && currentId && !reloadScheduled.current) {
        reloadScheduled.current = true;
        console.log("[SessionWatcher] New session detected, reloading in 500ms...");
        setTimeout(() => {
          window.location.reload();
        }, 500);
        return;
      }

      prevSessionId.current = currentId;
    });

    return () => {
      unsubscribe();
    };
  }, [clerk.loaded]); // eslint-disable-line react-hooks/exhaustive-deps

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
