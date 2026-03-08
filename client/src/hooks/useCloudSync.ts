/**
 * useCloudSync — headless auto-save hook for Project Retire
 *
 * Responsibilities:
 *  - On sign-in: detect existing cloud plan and expose it for the
 *    on-login banner (does NOT auto-load — that's the user's choice).
 *  - Auto-save: debounced 3s after any input change, silently.
 *  - Exposes sync status + last-saved time for the sidebar indicator.
 *  - Exposes doLoad() so the banner can trigger a load.
 *
 * No UI is rendered here — all display is handled by Sidebar and Overview.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/react";
import { toast } from "sonner";
import { usePlanner } from "@/contexts/PlannerContext";
import { trpc } from "@/lib/trpc";

export const CLOUD_PLAN_NAME = "My Retirement Plan";
export const SCENARIOS_KEY = "retirement-planner-scenarios-v1";

export type SyncStatus = "idle" | "saving" | "saved" | "error";

export interface CloudSyncState {
  status: SyncStatus;
  lastSaved: Date | null;
  /** The plan ID being auto-saved to (null until first save) */
  cloudPlanId: number | null;
  /** Display name of the active plan (shown in sidebar strip) */
  activePlanName: string | null;
  /** Plan data found on login — null if none or already handled */
  pendingCloudPlan: { id: number; name: string; updatedAt: Date | string | null; data: unknown } | null;
  /** Call this to load the pending cloud plan into the active session */
  doLoad: () => void;
  /** Dismiss the pending cloud plan banner without loading */
  dismissPendingPlan: () => void;
  /** Manually trigger a save */
  doSave: (silent?: boolean) => Promise<void>;
}

export function useCloudSync(): CloudSyncState {
  const { isSignedIn, isLoaded } = useUser();
  const { inputs, importFromObject } = usePlanner();

  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [cloudPlanId, setCloudPlanId] = useState<number | null>(null);
  const [activePlanName, setActivePlanName] = useState<string | null>(null);
  const [pendingCloudPlan, setPendingCloudPlan] = useState<CloudSyncState["pendingCloudPlan"]>(null);

  // Block auto-save until the on-login decision is settled
  const cloudLoadSettled = useRef(false);
  const isFirstLoad = useRef(true);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const utils = trpc.useUtils();

  const plansQuery = trpc.plans.list.useQuery(undefined, {
    enabled: Boolean(isSignedIn),
    retry: false,
  });

  const getPlan = trpc.plans.get.useQuery(
    { planId: cloudPlanId! },
    { enabled: cloudPlanId !== null && isSignedIn === true, retry: false }
  );

  const createPlan = trpc.plans.create.useMutation();
  const savePlan = trpc.plans.save.useMutation();

  // ── Find the cloud plan ID from the plan list ─────────────────────────────
  useEffect(() => {
    if (!plansQuery.data) return;
    const existing = plansQuery.data.find((p) => p.name === CLOUD_PLAN_NAME);
    if (existing) {
      setCloudPlanId(existing.id);
      setActivePlanName(existing.name);
    } else {
      // No cloud plan yet — safe to start auto-saving immediately
      cloudLoadSettled.current = true;
    }
  }, [plansQuery.data]);

  // ── On first login: expose pending cloud plan for the banner ─────────────
  useEffect(() => {
    if (!isFirstLoad.current) return;
    if (!isSignedIn || !getPlan.data) return;
    isFirstLoad.current = false;

    const planData = getPlan.data.data as Record<string, unknown> | null;
    if (planData) {
      // Expose to the banner — don't auto-load
      setPendingCloudPlan({
        id: getPlan.data.id,
        name: getPlan.data.name,
        updatedAt: getPlan.data.updatedAt,
        data: planData,
      });
      // Keep auto-save blocked until user decides
    } else {
      cloudLoadSettled.current = true;
    }
  }, [isSignedIn, getPlan.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save implementation ──────────────────────────────────────────────────
  const doSave = useCallback(async (silent = false) => {
    if (!isSignedIn) return;
    setStatus("saving");

    let scenarios: unknown = [];
    try {
      const raw = localStorage.getItem(SCENARIOS_KEY);
      if (raw) scenarios = JSON.parse(raw);
    } catch { /* ignore */ }

    const payload = {
      _version: 2,
      _exported: new Date().toISOString(),
      inputs,
      scenarios,
    };

    try {
      if (cloudPlanId) {
        await savePlan.mutateAsync({ planId: cloudPlanId, data: payload, name: CLOUD_PLAN_NAME });
      } else {
        const result = await createPlan.mutateAsync({ name: CLOUD_PLAN_NAME, data: payload });
        setCloudPlanId(result.planId);
        setActivePlanName(CLOUD_PLAN_NAME);
        await utils.plans.list.invalidate();
      }
      setLastSaved(new Date());
      setStatus("saved");
      if (!silent) toast.success("Plan saved!");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err: unknown) {
      setStatus("error");
      const msg = err instanceof Error ? err.message : "Save failed";
      if (!silent) toast.error(msg);
      setTimeout(() => setStatus("idle"), 3000);
    }
  }, [isSignedIn, cloudPlanId, inputs, savePlan, createPlan, utils]);

  // ── Load implementation ──────────────────────────────────────────────────
  const doLoad = useCallback(() => {
    if (!pendingCloudPlan?.data) return;
    const data = pendingCloudPlan.data as Record<string, unknown>;
    const result = importFromObject(data);
    if (!result.ok) {
      toast.error(result.error ?? "Failed to load plan.");
      return;
    }
    if (Array.isArray(data.scenarios)) {
      try {
        localStorage.setItem(SCENARIOS_KEY, JSON.stringify(data.scenarios));
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: SCENARIOS_KEY,
            newValue: JSON.stringify(data.scenarios),
            storageArea: localStorage,
          })
        );
      } catch { /* ignore */ }
    }
    toast.success("Cloud plan loaded!");
    setPendingCloudPlan(null);
    cloudLoadSettled.current = true;
  }, [pendingCloudPlan, importFromObject]);

  const dismissPendingPlan = useCallback(() => {
    setPendingCloudPlan(null);
    cloudLoadSettled.current = true;
  }, []);

  // ── Auto-save (debounced 3s) ─────────────────────────────────────────────
  useEffect(() => {
    if (!isSignedIn) return;
    if (!cloudLoadSettled.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      doSave(true);
    }, 3000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [inputs, isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    status,
    lastSaved,
    cloudPlanId,
    activePlanName,
    pendingCloudPlan,
    doLoad,
    dismissPendingPlan,
    doSave,
  };
}
