/**
 * useAuth — thin wrapper around Clerk's useUser/useClerk hooks.
 * Provides a consistent interface for the rest of the app.
 */
import { useClerk, useUser } from "@clerk/react";
import { useCallback } from "react";

export function useAuth() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();

  const logout = useCallback(async () => {
    await signOut();
  }, [signOut]);

  return {
    user: isSignedIn && user
      ? {
          id: user.id,
          name: user.fullName ?? user.firstName ?? null,
          email: user.primaryEmailAddress?.emailAddress ?? null,
        }
      : null,
    loading: !isLoaded,
    error: null,
    isAuthenticated: Boolean(isSignedIn),
    logout,
    refresh: () => {},
  };
}
