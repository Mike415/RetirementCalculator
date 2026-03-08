/**
 * CloudSyncContext — shares a single useCloudSync instance across the app
 * so Sidebar (status indicator) and Overview (on-login banner) both read
 * from the same state without creating duplicate auto-save timers.
 */

import { createContext, useContext } from "react";
import { useCloudSync, type CloudSyncState } from "@/hooks/useCloudSync";

const CloudSyncContext = createContext<CloudSyncState | null>(null);

export function CloudSyncProvider({ children }: { children: React.ReactNode }) {
  const sync = useCloudSync();
  return (
    <CloudSyncContext.Provider value={sync}>
      {children}
    </CloudSyncContext.Provider>
  );
}

export function useCloudSyncContext(): CloudSyncState {
  const ctx = useContext(CloudSyncContext);
  if (!ctx) throw new Error("useCloudSyncContext must be used inside CloudSyncProvider");
  return ctx;
}
