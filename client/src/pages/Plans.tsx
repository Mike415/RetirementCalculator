/**
 * Manage Plans — Active Plan model
 *
 * - Each plan card shows name, last-saved timestamp, and action buttons
 * - The active plan (tracked via cloudPlanId) has a green "Active" badge
 * - "New Plan" modal lets you start blank or fork the current active plan
 * - Fork any existing plan via the copy button on its card
 * - Plan limit progress bar shows usage vs. tier cap
 * - Rename inline with double-click or pencil icon
 * - Delete with a two-click confirmation
 */

import { useCloudSyncContext } from "@/contexts/CloudSyncContext";
import { usePlanner } from "@/contexts/PlannerContext";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { SignInButton, useUser } from "@clerk/react";
import {
  CheckCircle2,
  Clock,
  Copy,
  FilePlus2,
  FolderOpen,
  LogIn,
  Pencil,
  Plus,
  Trash2,
  X,
  Loader2,
  Cloud,
  History,
  RotateCcw,
  Lock,
} from "lucide-react";
import { useTierLimits } from "@/hooks/useTierLimits";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const SCENARIOS_KEY = "retirement-planner-scenarios-v1";
const ACTIVE_PLAN_KEY = "rp_active_plan_id";

// Tier limits (mirrors server/routers.ts MAX_PLANS)
const MAX_PLANS: Record<string, number> = { free: 0, basic: 1, pro: 10 };
const BETA_MAX = 10; // during beta all users get pro-level access

type PlanMeta = {
  id: number;
  name: string;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
};

function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "Never saved";
  const d = new Date(date as string);
  if (isNaN(d.getTime())) return "Unknown";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ── Plan Card ─────────────────────────────────────────────────────────────────
function PlanCard({
  plan,
  isActive,
  onLoad,
  onRename,
  onDelete,
  onFork,
  onHistory,
  loading,
}: {
  plan: PlanMeta;
  isActive: boolean;
  onLoad: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onFork: () => void;
  onHistory: () => void;
  loading: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(plan.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync editName when plan.name changes (e.g. after a rename saves and the list re-fetches)
  useEffect(() => {
    if (!editing) setEditName(plan.name);
  }, [plan.name, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commitRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== plan.name) onRename(trimmed);
    else setEditName(plan.name);
    setEditing(false);
  };

  const handleDeleteClick = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      confirmTimer.current = setTimeout(() => setConfirmDelete(false), 3000);
    } else {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      onDelete();
    }
  };

  return (
    <div
      className={cn(
        "group relative bg-white rounded-2xl border shadow-sm p-5 transition-all duration-150",
        isActive
          ? "border-emerald-300 ring-1 ring-emerald-100"
          : "border-slate-100 hover:border-slate-200 hover:shadow-md"
      )}
    >
      {/* Active badge */}
      {isActive && (
        <div className="absolute top-4 right-4 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wide">
          <CheckCircle2 className="w-3 h-3" />
          Active
        </div>
      )}

      {/* Plan name */}
      <div className="flex items-center gap-2 mb-1 pr-20">
        {editing ? (
          <input
            ref={inputRef}
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") { setEditName(plan.name); setEditing(false); }
            }}
            className="flex-1 text-sm font-semibold text-slate-800 bg-transparent border-b-2 border-emerald-400 outline-none pb-0.5"
          />
        ) : (
          <h3
            className="flex-1 text-sm font-semibold text-slate-800 truncate cursor-pointer"
            onDoubleClick={() => setEditing(true)}
            title="Double-click to rename"
          >
            {plan.name}
          </h3>
        )}
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-400 hover:text-slate-600 transition-all"
            title="Rename"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Last saved */}
      <p className="flex items-center gap-1 text-[11px] text-slate-400 mb-4">
        <Clock className="w-3 h-3" />
        {timeAgo(plan.updatedAt)}
        {plan.updatedAt && (
          <span className="text-slate-300 ml-1">
            · {new Date(plan.updatedAt as string).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        )}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isActive ? (
          <div className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-semibold border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Currently active — auto-saving
          </div>
        ) : (
          <button
            onClick={onLoad}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-semibold hover:bg-[#2D6A4F] transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FolderOpen className="w-3.5 h-3.5" />
            )}
            Load
          </button>
        )}

        <button
          onClick={onFork}
          className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          title="Fork (duplicate) this plan"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onHistory}
          className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          title="Version history"
        >
          <History className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleDeleteClick}
          className={cn(
            "p-2 rounded-xl transition-colors",
            confirmDelete
              ? "bg-red-100 text-red-600 hover:bg-red-200"
              : "text-slate-400 hover:bg-red-50 hover:text-red-500"
          )}
          title={confirmDelete ? "Click again to confirm delete" : "Delete plan"}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {confirmDelete && (
        <p className="text-[10px] text-red-500 mt-2 text-center font-medium animate-pulse">
          Click trash again to permanently delete
        </p>
      )}
    </div>
  );
}

// ── New Plan Modal ────────────────────────────────────────────────────────────
function NewPlanModal({
  onClose,
  onCreateBlank,
  onForkCurrent,
}: {
  onClose: () => void;
  onCreateBlank: (name: string) => void;
  onForkCurrent: (name: string) => void;
}) {
  const [name, setName] = useState("My Retirement Plan");
  const [mode, setMode] = useState<"fork" | "blank">("fork");

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (mode === "blank") onCreateBlank(trimmed);
    else onForkCurrent(trimmed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-slate-800">New Plan</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <button
            onClick={() => setMode("fork")}
            className={cn(
              "flex flex-col items-center gap-1.5 p-3.5 rounded-xl border text-xs font-medium transition-all",
              mode === "fork"
                ? "border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm"
                : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            <Copy className="w-5 h-5" />
            <span>Fork current plan</span>
            <span className="text-[10px] font-normal text-slate-400 text-center leading-tight">
              Copy of what's open now
            </span>
          </button>
          <button
            onClick={() => setMode("blank")}
            className={cn(
              "flex flex-col items-center gap-1.5 p-3.5 rounded-xl border text-xs font-medium transition-all",
              mode === "blank"
                ? "border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm"
                : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
            )}
          >
            <FilePlus2 className="w-5 h-5" />
            <span>Start blank</span>
            <span className="text-[10px] font-normal text-slate-400 text-center leading-tight">
              Default inputs
            </span>
          </button>
        </div>

        {/* Name input */}
        <label className="block text-xs font-semibold text-slate-600 mb-1.5">Plan name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
            if (e.key === "Escape") onClose();
          }}
          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 transition-colors mb-5"
          placeholder="e.g. Early Retirement Scenario"
          maxLength={255}
        />

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#2D6A4F] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Create plan
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Version History Modal ────────────────────────────────────────────────────
type PlanVersion = { id: number; savedAt: Date | string; data: unknown };

function VersionHistoryModal({
  planId,
  planName,
  hasAccess,
  onClose,
  onRestore,
}: {
  planId: number;
  planName: string;
  hasAccess: boolean;
  onClose: () => void;
  onRestore: (data: unknown) => void;
}) {
  const versionsQuery = trpc.plans.versions.useQuery(
    { planId },
    { enabled: hasAccess, retry: false }
  );
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const handleRestore = async (version: PlanVersion) => {
    setRestoringId(version.id);
    try {
      onRestore(version.data);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-800">Version History</h2>
            <p className="text-xs text-slate-500 mt-0.5">{planName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!hasAccess ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
              <Lock className="w-6 h-6 text-slate-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">Version history is a paid feature</p>
              <p className="text-xs text-slate-500 mt-1">Upgrade to Basic or Pro to access up to 10 saved snapshots per plan.</p>
            </div>
            <a
              href="#/billing"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-semibold hover:bg-[#2D6A4F] transition-colors"
            >
              View Plans
            </a>
          </div>
        ) : versionsQuery.isLoading ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : !versionsQuery.data?.length ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8 text-center">
            <History className="w-8 h-8 text-slate-200" />
            <p className="text-sm font-semibold text-slate-500">No versions saved yet</p>
            <p className="text-xs text-slate-400">Versions are created automatically each time you save this plan.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2">
            {versionsQuery.data.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50 hover:bg-white transition-colors"
              >
                <div>
                  <p className="text-xs font-semibold text-slate-700">
                    {new Date(v.savedAt as unknown as string).toLocaleString(undefined, {
                      month: "short", day: "numeric", year: "numeric",
                      hour: "numeric", minute: "2-digit",
                    })}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {timeAgo(v.savedAt as unknown as string)}
                  </p>
                </div>
                <button
                  onClick={() => handleRestore(v as PlanVersion)}
                  disabled={restoringId === v.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1B4332] text-white text-xs font-semibold hover:bg-[#2D6A4F] transition-colors disabled:opacity-50"
                >
                  {restoringId === v.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3 h-3" />
                  )}
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] text-slate-400 text-center mt-4">
          Restoring a version loads it into your active session but does not overwrite the saved plan.
        </p>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Plans() {
  const { isSignedIn, isLoaded } = useUser();
  const { inputs, importFromObject } = usePlanner();
  const { cloudPlanId, doSave } = useCloudSyncContext();
  const [showNewModal, setShowNewModal] = useState(false);
  const [loadingPlanId, setLoadingPlanId] = useState<number | null>(null);
  const [historyPlanId, setHistoryPlanId] = useState<number | null>(null);
  const [historyPlanName, setHistoryPlanName] = useState("");
  const { features } = useTierLimits();
  // Track which plan was most recently loaded by the user on this page.
  // Falls back to cloudPlanId (the auto-save plan) when nothing has been
  // explicitly loaded yet.
  // Persist activePlanId in localStorage so it survives navigation
  const [activePlanId, setActivePlanId] = useState<number | null>(() => {
    try {
      const stored = localStorage.getItem(ACTIVE_PLAN_KEY);
      return stored ? parseInt(stored, 10) : null;
    } catch { return null; }
  });

  const setActivePlan = (id: number | null) => {
    setActivePlanId(id);
    try {
      if (id !== null) localStorage.setItem(ACTIVE_PLAN_KEY, String(id));
      else localStorage.removeItem(ACTIVE_PLAN_KEY);
    } catch { /* ignore */ }
  };

  const utils = trpc.useUtils();
  const plansQuery = trpc.plans.list.useQuery(undefined, {
    enabled: Boolean(isSignedIn),
    retry: false,
  });
  const userProfile = trpc.user.profile.useQuery(undefined, {
    enabled: Boolean(isSignedIn),
    retry: false,
  });

  const createPlan = trpc.plans.create.useMutation({
    onSuccess: () => utils.plans.list.invalidate(),
  });
  const savePlan = trpc.plans.save.useMutation({
    onSuccess: () => utils.plans.list.invalidate(),
  });
  const deletePlan = trpc.plans.delete.useMutation({
    onSuccess: () => utils.plans.list.invalidate(),
  });

  const plansList = plansQuery.data ?? [];
  const tier = userProfile.data?.planTier ?? "basic";
  const maxPlans = Math.max(MAX_PLANS[tier] ?? 1, BETA_MAX);
  const usedPlans = plansList.length;
  const canCreate = usedPlans < maxPlans;

  // ── Load a plan into the active session ────────────────────────────────────
  const handleLoad = async (plan: PlanMeta) => {
    setLoadingPlanId(plan.id);
    try {
      const full = await utils.plans.get.fetch({ planId: plan.id });
      const data = full.data as Record<string, unknown> | null;
      if (!data) { toast.error("Plan has no saved data."); return; }

      const result = importFromObject(data);
      if (!result.ok) { toast.error(result.error ?? "Failed to load plan."); return; }

      if (Array.isArray(data.scenarios)) {
        try {
          localStorage.setItem(SCENARIOS_KEY, JSON.stringify(data.scenarios));
          window.dispatchEvent(new StorageEvent("storage", {
            key: SCENARIOS_KEY,
            newValue: JSON.stringify(data.scenarios),
            storageArea: localStorage,
          }));
        } catch { /* ignore */ }
      }
      // Mark this plan as the currently active one in the UI
      setActivePlan(plan.id);
      toast.success(`"${plan.name}" loaded!`);
    } catch {
      toast.error("Failed to load plan.");
    } finally {
      setLoadingPlanId(null);
    }
  };

  // ── Rename a plan ──────────────────────────────────────────────────────────
  const handleRename = async (planId: number, name: string) => {
    try {
      const full = await utils.plans.get.fetch({ planId });
      await savePlan.mutateAsync({ planId, data: full.data, name });
      toast.success("Plan renamed.");
    } catch {
      toast.error("Failed to rename plan.");
    }
  };

  // ── Delete a plan ──────────────────────────────────────────────────────────
  const handleDelete = async (planId: number) => {
    await deletePlan.mutateAsync({ planId });
    toast.success("Plan deleted.");
  };

  // ── Fork a specific plan ───────────────────────────────────────────────────
  const handleForkPlan = async (sourcePlanId: number, newName: string) => {
    if (!canCreate) { toast.error(`You've reached the ${maxPlans}-plan limit.`); return; }
    try {
      const full = await utils.plans.get.fetch({ planId: sourcePlanId });
      await createPlan.mutateAsync({ name: newName, data: full.data });
      toast.success(`"${newName}" created as a fork.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to fork plan.");
    }
  };

  // ── Create blank plan ──────────────────────────────────────────────────────
  const handleCreateBlank = async (name: string) => {
    if (!canCreate) { toast.error(`You've reached the ${maxPlans}-plan limit.`); return; }
    try {
      const payload = { _version: 2, _exported: new Date().toISOString(), inputs: {}, scenarios: [] };
      await createPlan.mutateAsync({ name, data: payload });
      toast.success(`"${name}" created.`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create plan.");
    }
  };

  // ── Fork current active plan ───────────────────────────────────────────────
  const handleForkCurrent = async (name: string) => {
    if (!canCreate) { toast.error(`You've reached the ${maxPlans}-plan limit.`); return; }
    try {
      // First flush the current state to the cloud so the fork is up to date
      await doSave(true);
      if (cloudPlanId) {
        await handleForkPlan(cloudPlanId, name);
      } else {
        // No cloud plan yet — create directly from current inputs
        const raw = localStorage.getItem(SCENARIOS_KEY);
        const scenarios = raw ? JSON.parse(raw) : [];
        const payload = { _version: 2, _exported: new Date().toISOString(), inputs, scenarios };
        await createPlan.mutateAsync({ name, data: payload });
        toast.success(`"${name}" created from current inputs.`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to fork plan.");
    }
  };

  // When cloudPlanId is first available and no explicit activePlanId is set, use it as default
  useEffect(() => {
    if (cloudPlanId && activePlanId === null) {
      setActivePlan(cloudPlanId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudPlanId]);

  // ── Not loaded ─────────────────────────────────────────────────────────────
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  // ── Signed out ─────────────────────────────────────────────────────────────
  if (!isSignedIn) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
          <Cloud className="w-7 h-7 text-slate-300" />
        </div>
        <h1 className="text-xl font-bold text-slate-700">My Plans</h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          Sign in to save multiple retirement scenarios to the cloud and switch between them at any time.
        </p>
        <SignInButton mode="modal">
          <button className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#2D6A4F] transition-colors">
            <LogIn className="w-4 h-4" />
            Sign in to get started
          </button>
        </SignInButton>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Plans</h1>
          <p className="text-sm text-slate-500 mt-1">
            Save different scenarios and switch between them at any time.
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          disabled={!canCreate}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1B4332] text-white text-sm font-semibold hover:bg-[#2D6A4F] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          title={!canCreate ? `Plan limit reached (${maxPlans})` : "Create a new plan"}
        >
          <Plus className="w-4 h-4" />
          New plan
        </button>
      </div>

      {/* Plan limit bar */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-600">Plans used</span>
          <span className="text-xs text-slate-500 tabular-nums">
            {usedPlans} / {maxPlans}
          </span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              usedPlans >= maxPlans
                ? "bg-red-400"
                : usedPlans >= maxPlans * 0.8
                ? "bg-amber-400"
                : "bg-emerald-500"
            )}
            style={{ width: `${Math.min(100, (usedPlans / maxPlans) * 100)}%` }}
          />
        </div>
        {usedPlans >= maxPlans && (
          <p className="text-[10px] text-red-500 mt-1.5 font-medium">
            Plan limit reached. Delete a plan to create a new one.
          </p>
        )}
      </div>

      {/* Plans grid */}
      {plansQuery.isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-1/2 mb-4" />
              <div className="h-9 bg-slate-100 rounded-xl" />
            </div>
          ))}
        </div>
      ) : plansList.length === 0 ? (
        <div className="text-center py-16 space-y-3 border border-dashed border-slate-200 rounded-2xl bg-slate-50">
          <FolderOpen className="w-10 h-10 text-slate-200 mx-auto" />
          <p className="text-sm font-semibold text-slate-500">No saved plans yet</p>
          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            Your inputs are auto-saved continuously. Use "New plan" to create a named snapshot
            or a what-if scenario you can come back to.
          </p>
          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1B4332] text-white text-xs font-semibold hover:bg-[#2D6A4F] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Create first plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {plansList.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isActive={plan.id === (activePlanId ?? cloudPlanId ?? -1)}
              onLoad={() => handleLoad(plan)}
              onRename={(name) => handleRename(plan.id, name)}
              onDelete={() => handleDelete(plan.id)}
              onFork={() => handleForkPlan(plan.id, `${plan.name} (copy)`)}
              onHistory={() => { setHistoryPlanId(plan.id); setHistoryPlanName(plan.name); }}
              loading={loadingPlanId === plan.id}
            />
          ))}
        </div>
      )}

      {/* Auto-save note */}
      {plansList.length > 0 && (
        <p className="text-xs text-slate-400 text-center pb-2">
          Changes to the active plan are auto-saved every few seconds.
          Use "New plan" to create a separate named snapshot or what-if scenario.
        </p>
      )}

      {/* New Plan Modal */}
      {showNewModal && (
        <NewPlanModal
          onClose={() => setShowNewModal(false)}
          onCreateBlank={handleCreateBlank}
          onForkCurrent={handleForkCurrent}
        />
      )}

      {/* Version History Modal */}
      {historyPlanId !== null && (
        <VersionHistoryModal
          planId={historyPlanId}
          planName={historyPlanName}
          hasAccess={features.versionHistory}
          onClose={() => setHistoryPlanId(null)}
          onRestore={(data) => {
            const result = importFromObject(data as Record<string, unknown>);
            if (result.ok) {
              toast.success("Version restored!");
              setHistoryPlanId(null);
            } else {
              toast.error(result.error ?? "Failed to restore version.");
            }
          }}
        />
      )}
    </div>
  );
}
