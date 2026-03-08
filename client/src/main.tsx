import { ClerkProvider, useAuth } from "@clerk/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { trpc } from "./lib/trpc";
import "./index.css";

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;

if (!CLERK_PUBLISHABLE_KEY) {
  console.error("Missing VITE_CLERK_PUBLISHABLE_KEY environment variable");
}

// Create stable instances outside the component so they don't re-create on every render.
// The tRPC client reads the token lazily via the headers() callback, so it always
// uses the latest Clerk token without needing to be recreated.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

/**
 * Inner component that has access to Clerk's useAuth hook so we can:
 * 1. Attach the Clerk session token to every tRPC request.
 * 2. Invalidate all tRPC queries when auth state changes (sign-in/sign-out),
 *    so the UI refreshes automatically without a manual page reload.
 */
function TrpcProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn, isLoaded } = useAuth();

  // Stable tRPC client — reads token lazily so it always has the latest JWT
  const trpcClient = useMemo(
    () =>
      trpc.createClient({
        links: [
          httpBatchLink({
            url: "/api/trpc",
            transformer: superjson,
            async headers() {
              const token = await getToken();
              return token ? { Authorization: `Bearer ${token}` } : {};
            },
          }),
        ],
      }),
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Track previous auth state so we only invalidate on actual changes
  const prevIsSignedIn = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    if (!isLoaded) return; // Wait until Clerk has resolved
    if (prevIsSignedIn.current === isSignedIn) return; // No change

    if (prevIsSignedIn.current !== undefined) {
      if (isSignedIn) {
        // User just signed in via Clerk modal — do a full page reload so the
        // session cookie is picked up cleanly and all queries re-fetch with
        // the new auth context. This is the most reliable fix for the
        // "must refresh after sign-in" bug with Clerk v6 modal mode.
        window.location.reload();
        return;
      }
      // User signed out — invalidate queries (no reload needed)
      queryClient.invalidateQueries();
    }
    prevIsSignedIn.current = isSignedIn;
  }, [isSignedIn, isLoaded]);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}

createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
    <TrpcProvider>
      <App />
    </TrpcProvider>
  </ClerkProvider>
);
