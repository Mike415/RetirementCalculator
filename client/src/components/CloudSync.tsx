/**
 * CloudSync — Clerk-authenticated cloud save/load using tRPC backend.
 *
 * When the user is signed in:
 *   - On first load, checks if a cloud plan exists and offers to load it.
 *   - Auto-save is BLOCKED until the load-on-login decision is settled
 *     (user loads, dismisses, or no cloud plan exists). This prevents
 *     overwriting cloud data with local placeholder values on first sign-in.
 *   - "Save to Cloud" saves the current plan to the database.
 *   - "Load from Cloud" loads the most recent saved plan.
 *   - Auto-save triggers 3 seconds after the last change (debounced).
 *
 * When signed out, shows a sign-in prompt.
 */

import { useClerk, useUser } from "@clerk/react";
import { Cloud, CloudDownload, CloudUpload, Loader2, LogIn } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { usePlanner } from "@/contexts/PlannerContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

const CLOUD_PLAN_NAME = "My Retirement Plan";
const SCENARIOS_KEY = "retirement-planner-scenarios-v1";

type SyncStatus = "idle" | "saving" | "loading" | "saved" | "error";

interface CloudSyncProps {
  onStatusChange?: (status: SyncStatus, lastSaved: Date | null) => void;
}

export default function CloudSync({ onStatusChange }: CloudSyncProps = {}) {
  const { isSignedIn, isLoaded } = useUser();
  const { openSignIn } = useClerk();
  const { inputs, importFromObject } = usePlanner();
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Notify parent of status changes
  useEffect(() => {
    onStatusChange?.(status, lastSaved);
  }, [status, lastSaved]); // eslint-disable-line react-hooks/exhaustive-deps

  const [cloudPlanId, setCloudPlanId] = useState<number | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // isFirstLoad: true until we've checked for a cloud plan on this session
  const isFirstLoad = useRef(true);
  // cloudLoadSettled: auto-save is blocked until this is true.
  // It becomes true when:
  //   (a) no cloud plan exists for this user, OR
  //   (b) the load-on-login toast has been shown (user can load or dismiss)
  const cloudLoadSettled = useRef(false);

  // ── tRPC hooks ──────────────────────────────────────────────────────────────
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
  const utils = trpc.useUtils();

  // ── Find or remember the cloud plan ID ─────────────────────────────────────
  useEffect(() => {
    if (!plansQuery.data) return;
    const existing = plansQuery.data.find((p) => p.name === CLOUD_PLAN_NAME);
    if (existing) {
      setCloudPlanId(existing.id);
    } else {
      // No cloud plan exists — safe to start auto-saving immediately
      cloudLoadSettled.current = true;
    }
  }, [plansQuery.data]);

  // ── Load on first login ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!isFirstLoad.current) return;
    if (!isSignedIn || !getPlan.data) return;
    isFirstLoad.current = false;

    const planData = getPlan.data.data as Record<string, unknown> | null;
    if (planData) {
      // Show the load prompt. Auto-save is still blocked at this point.
      // It will be unblocked after the toast action fires or the toast dismisses.
      toast("Cloud plan found", {
        description: "Load your saved plan from the cloud?",
        action: {
          label: "Load",
          onClick: () => {
            doLoad(planData);
            // After loading, allow auto-save (will reflect the loaded data)
            cloudLoadSettled.current = true;
          },
        },
        onDismiss: () => {
          // User dismissed — keep local data, allow auto-save going forward
          cloudLoadSettled.current = true;
        },
        onAutoClose: () => {
          // Toast timed out — keep local data, allow auto-save going forward
          cloudLoadSettled.current = true;
        },
        duration: 10000,
      });
    } else {
      // Cloud plan exists but has no data — settle immediately
      cloudLoadSettled.current = true;
    }
  }, [isSignedIn, getPlan.data]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save implementation ─────────────────────────────────────────────────────
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
        await utils.plans.list.invalidate();
      }
      setLastSaved(new Date());
      setStatus("saved");
      if (!silent) toast.success("Plan saved to cloud!");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err: unknown) {
      setStatus("error");
      const msg = err instanceof Error ? err.message : "Save failed";
      if (!silent) toast.error(msg);
      setTimeout(() => setStatus("idle"), 3000);
    }
  }, [isSignedIn, cloudPlanId, inputs, savePlan, createPlan, utils]);

  // ── Load implementation ─────────────────────────────────────────────────────
  const doLoad = useCallback((data: Record<string, unknown>) => {
    const result = importFromObject(data);
    if (!result.ok) {
      toast.error(result.error ?? "Failed to load plan.");
      return;
    }

    // Restore scenarios if present
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

    toast.success("Plan loaded from cloud!");
  }, [importFromObject]);

  const handleLoad = useCallback(async () => {
    if (!cloudPlanId) {
      toast.info("No cloud plan found. Save your plan first.");
      return;
    }
    setStatus("loading");
    try {
      const plan = await utils.plans.get.fetch({ planId: cloudPlanId });
      const planData = plan.data as Record<string, unknown> | null;
      if (!planData) {
        toast.info("Cloud plan is empty.");
        setStatus("idle");
        return;
      }
      doLoad(planData);
      setStatus("idle");
    } catch (err: unknown) {
      setStatus("error");
      const msg = err instanceof Error ? err.message : "Load failed";
      toast.error(msg);
      setTimeout(() => setStatus("idle"), 3000);
    }
  }, [cloudPlanId, utils, doLoad]);

  // ── Auto-save (debounced, 3s after last change) ─────────────────────────────
  // IMPORTANT: auto-save is blocked until cloudLoadSettled is true, preventing
  // the local placeholder data from overwriting the user's cloud plan on first login.
  useEffect(() => {
    if (!isSignedIn) return;
    if (!cloudLoadSettled.current) return; // Block until load decision is made

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      doSave(true);
    }, 3000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [inputs, isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const isBusy = status === "saving" || status === "loading";

  // ── Not loaded yet ──────────────────────────────────────────────────────────
  if (!isLoaded) return null;

  // ── Signed out ──────────────────────────────────────────────────────────────
  if (!isSignedIn) {
    return (
      <div className="border border-white/10 rounded-lg px-3 py-2.5 bg-white/5">
        <div className="flex items-center gap-2 mb-2">
          <Cloud className="w-3.5 h-3.5 text-white/40" />
          <span className="text-xs font-medium text-white/60">Cloud Sync</span>
        </div>
        <p className="text-[10px] text-white/40 leading-relaxed mb-2">
          Sign in to save your plan to the cloud and access it from any device.
        </p>
        <button
          onClick={() => openSignIn()}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-[#D97706] text-white text-xs font-medium hover:bg-[#B45309] transition-colors"
        >
          <LogIn className="w-3 h-3" />
          Sign in to sync
        </button>
      </div>
    );
  }

  // ── Signed in ───────────────────────────────────────────────────────────────
  return (
    <div className="border border-white/10 rounded-lg px-3 py-2.5 bg-white/5">
      <div className="flex items-center gap-2 mb-2">
        <Cloud className="w-3.5 h-3.5 text-emerald-400" />
        <span className="text-xs font-medium text-white/80 flex-1">Cloud Sync</span>
        {status === "saved" && (
          <span className="text-[9px] text-emerald-400 font-medium">● Saved</span>
        )}
        {status === "saving" && (
          <span className="text-[9px] text-white/40 font-medium flex items-center gap-1">
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Saving…
          </span>
        )}
        {lastSaved && status === "idle" && (
          <span className="text-[9px] text-white/30">
            {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="gap-1 text-[11px] h-7 bg-white/8 text-white/70 border-white/15 hover:bg-white/15 hover:text-white"
          onClick={() => doSave(false)}
          disabled={isBusy}
        >
          {status === "saving" ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <CloudUpload className="w-3 h-3" />
          )}
          Save
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1 text-[11px] h-7 bg-white/8 text-white/70 border-white/15 hover:bg-white/15 hover:text-white"
          onClick={handleLoad}
          disabled={isBusy || !cloudPlanId}
        >
          {status === "loading" ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <CloudDownload className="w-3 h-3" />
          )}
          Load
        </Button>
      </div>

      <p className="text-[9px] text-white/25 mt-1.5 leading-relaxed">
        Auto-saves 3s after each change.
      </p>
    </div>
  );
}
