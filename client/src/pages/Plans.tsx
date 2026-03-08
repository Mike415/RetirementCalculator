/**
 * Plans — Manage saved retirement plans
 * Lists all cloud-saved plans with rename, delete, load, and create actions.
 * Requires sign-in; shows a prompt for signed-out users.
 */

import { useState } from "react";
import { useUser, SignInButton } from "@clerk/react";
import { trpc } from "@/lib/trpc";
import { usePlanner } from "@/contexts/PlannerContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Cloud,
  CloudDownload,
  FilePlus2,
  LogIn,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  FolderOpen,
  Clock,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CLOUD_PLAN_NAME = "My Retirement Plan";
const SCENARIOS_KEY = "retirement-planner-scenarios-v1";

function formatDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Unknown";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface PlanRowProps {
  plan: {
    id: number;
    name: string;
    updatedAt: Date | string | null;
    createdAt: Date | string | null;
  };
  isActive: boolean;
  onLoad: (planId: number) => void;
  onRename: (planId: number, newName: string) => void;
  onDelete: (planId: number, name: string) => void;
  loading: boolean;
}

function PlanRow({ plan, isActive, onLoad, onRename, onDelete, loading }: PlanRowProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(plan.name);

  const handleRenameSubmit = () => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === plan.name) {
      setEditing(false);
      setEditName(plan.name);
      return;
    }
    onRename(plan.id, trimmed);
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleRenameSubmit();
    if (e.key === "Escape") {
      setEditing(false);
      setEditName(plan.name);
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all",
        isActive
          ? "bg-[#1B4332]/5 border-[#1B4332]/20"
          : "bg-white border-stone-200 hover:border-stone-300 hover:shadow-sm"
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
          isActive ? "bg-[#1B4332]/10" : "bg-stone-100"
        )}
      >
        <FolderOpen
          className={cn("w-4.5 h-4.5", isActive ? "text-[#1B4332]" : "text-stone-400")}
        />
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 text-sm font-medium bg-white border border-[#1B4332]/30 rounded-md px-2 py-0.5 outline-none focus:ring-1 focus:ring-[#1B4332]/40 text-stone-800"
              maxLength={255}
            />
            <button
              onClick={handleRenameSubmit}
              className="p-1 rounded text-emerald-600 hover:bg-emerald-50"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setEditName(plan.name);
              }}
              className="p-1 rounded text-stone-400 hover:bg-stone-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-stone-800 truncate">{plan.name}</p>
            {isActive && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#1B4332] text-white uppercase tracking-wide flex-shrink-0">
                Active
              </span>
            )}
          </div>
        )}
        <div className="flex items-center gap-1 mt-0.5">
          <Clock className="w-3 h-3 text-stone-300 flex-shrink-0" />
          <p className="text-[11px] text-stone-400 truncate">
            Last saved {formatDate(plan.updatedAt)}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {!isActive && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 text-stone-600 border-stone-200 hover:border-[#1B4332]/30 hover:text-[#1B4332]"
            onClick={() => onLoad(plan.id)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <CloudDownload className="w-3 h-3" />
            )}
            Load
          </Button>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => setEditing(true)}>
              <Pencil className="w-3.5 h-3.5 mr-2" />
              Rename
            </DropdownMenuItem>
            {!isActive && (
              <DropdownMenuItem onClick={() => onLoad(plan.id)}>
                <CloudDownload className="w-3.5 h-3.5 mr-2" />
                Load plan
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
              onClick={() => onDelete(plan.id, plan.name)}
            >
              <Trash2 className="w-3.5 h-3.5 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function Plans() {
  const { isSignedIn, isLoaded } = useUser();
  const { inputs, importFromObject } = usePlanner();
  const [loadingPlanId, setLoadingPlanId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");

  const utils = trpc.useUtils();
  const plansQuery = trpc.plans.list.useQuery(undefined, {
    enabled: Boolean(isSignedIn),
    retry: false,
  });

  const getPlan = trpc.plans.get.useQuery(
    { planId: loadingPlanId! },
    { enabled: loadingPlanId !== null && isSignedIn === true, retry: false }
  );

  const savePlan = trpc.plans.save.useMutation({
    onSuccess: () => utils.plans.list.invalidate(),
  });

  const createPlan = trpc.plans.create.useMutation({
    onSuccess: () => {
      utils.plans.list.invalidate();
      setCreating(false);
      setNewPlanName("");
      toast.success("New plan created!");
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to create plan.");
    },
  });

  const deletePlan = trpc.plans.delete.useMutation({
    onSuccess: () => {
      utils.plans.list.invalidate();
      toast.success("Plan deleted.");
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(err.message ?? "Failed to delete plan.");
      setDeleteTarget(null);
    },
  });

  const renamePlan = trpc.plans.save.useMutation({
    onSuccess: () => {
      utils.plans.list.invalidate();
      toast.success("Plan renamed.");
    },
    onError: (err) => toast.error(err.message ?? "Failed to rename plan."),
  });

  // Load plan data when loadingPlanId changes
  const [activePlanId, setActivePlanId] = useState<number | null>(null);

  // When getPlan data arrives, import it
  const [pendingLoad, setPendingLoad] = useState(false);
  if (pendingLoad && getPlan.data && !getPlan.isLoading) {
    const planData = getPlan.data.data as Record<string, unknown> | null;
    if (planData) {
      try {
        // CloudSync saves as { _version, _exported, inputs, scenarios }
        // importFromObject expects the full payload object
        const result = importFromObject(planData);
        if (result.ok) {
          if (planData.scenarios && typeof window !== "undefined") {
            try {
              localStorage.setItem(SCENARIOS_KEY, JSON.stringify(planData.scenarios));
            } catch {}
          }
          setActivePlanId(loadingPlanId);
          toast.success(`"${getPlan.data.name}" loaded successfully!`);
        } else {
          toast.error(result.error ?? "Failed to load plan data.");
        }
      } catch {
        toast.error("Failed to load plan data.");
      }
    }
    setPendingLoad(false);
    setLoadingPlanId(null);
  }

  const handleLoad = (planId: number) => {
    setLoadingPlanId(planId);
    setPendingLoad(true);
  };

  const handleRename = (planId: number, newName: string) => {
    // Get current data for the plan to avoid overwriting it with undefined
    const plan = planList.find((p) => p.id === planId);
    renamePlan.mutate({ planId, name: newName, data: plan ?? {} });
  };

  const handleDelete = (planId: number, name: string) => {
    setDeleteTarget({ id: planId, name });
  };

  const handleCreatePlan = () => {
    const name = newPlanName.trim() || `Plan ${(plansQuery.data?.length ?? 0) + 1}`;
    // Capture current plan data
    const scenarios = (() => {
      try {
        return JSON.parse(localStorage.getItem(SCENARIOS_KEY) ?? "[]");
      } catch {
        return [];
      }
    })();
    createPlan.mutate({
      name,
      data: {
        _version: 2,
        _exported: new Date().toISOString(),
        inputs,
        scenarios,
      },
    });
  };

  const handleSaveCurrentAs = (planId: number) => {
    const scenarios = (() => {
      try {
        return JSON.parse(localStorage.getItem(SCENARIOS_KEY) ?? "[]");
      } catch {
        return [];
      }
    })();
    savePlan.mutate(
      { planId, data: { _version: 2, _exported: new Date().toISOString(), inputs, scenarios } },
      {
        onSuccess: () => toast.success("Plan saved!"),
        onError: (err) => toast.error(err.message ?? "Failed to save."),
      }
    );
  };

  // ── Not loaded ──────────────────────────────────────────────────────────────
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
      </div>
    );
  }

  // ── Signed out ──────────────────────────────────────────────────────────────
  if (!isSignedIn) {
    return (
      <div className="max-w-xl mx-auto">
        <div className="mb-6">
          <h1
            className="text-2xl font-bold text-stone-800 mb-1"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            My Plans
          </h1>
          <p className="text-stone-500 text-sm">Manage your saved retirement plans.</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
            <Cloud className="w-6 h-6 text-stone-400" />
          </div>
          <h2 className="text-base font-semibold text-stone-700 mb-2">Sign in to manage plans</h2>
          <p className="text-sm text-stone-400 mb-5 leading-relaxed">
            Create an account to save multiple retirement scenarios to the cloud and access them
            from any device.
          </p>
          <SignInButton mode="modal">
            <Button className="bg-[#D97706] hover:bg-[#B45309] text-white gap-2">
              <LogIn className="w-4 h-4" />
              Sign in to get started
            </Button>
          </SignInButton>
        </div>
      </div>
    );
  }

  const planList = plansQuery.data ?? [];
  const isLoading = plansQuery.isLoading;
  const maxPlans = 10; // Pro tier during beta

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-stone-800 mb-1"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            My Plans
          </h1>
          <p className="text-stone-500 text-sm">
            {planList.length} of {maxPlans} plans used
          </p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          disabled={planList.length >= maxPlans || creating}
          className="bg-[#1B4332] hover:bg-[#145229] text-white gap-2 text-sm"
          size="sm"
        >
          <FilePlus2 className="w-4 h-4" />
          Save current as new plan
        </Button>
      </div>

      {/* Create new plan form */}
      {creating && (
        <div className="mb-4 p-4 rounded-xl border border-[#1B4332]/20 bg-[#1B4332]/5">
          <p className="text-sm font-medium text-stone-700 mb-2">Name your new plan</p>
          <div className="flex gap-2">
            <input
              autoFocus
              value={newPlanName}
              onChange={(e) => setNewPlanName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreatePlan();
                if (e.key === "Escape") {
                  setCreating(false);
                  setNewPlanName("");
                }
              }}
              placeholder={`Plan ${planList.length + 1}`}
              className="flex-1 text-sm bg-white border border-stone-200 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-[#1B4332]/40 text-stone-800"
              maxLength={255}
            />
            <Button
              size="sm"
              onClick={handleCreatePlan}
              disabled={createPlan.isPending}
              className="bg-[#1B4332] hover:bg-[#145229] text-white"
            >
              {createPlan.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setCreating(false);
                setNewPlanName("");
              }}
            >
              Cancel
            </Button>
          </div>
          <p className="text-[11px] text-stone-400 mt-1.5">
            This will save a snapshot of your current plan inputs.
          </p>
        </div>
      )}

      {/* Plan list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
        </div>
      ) : planList.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-3">
            <FolderOpen className="w-6 h-6 text-stone-300" />
          </div>
          <p className="text-sm font-medium text-stone-500 mb-1">No saved plans yet</p>
          <p className="text-xs text-stone-400 mb-4">
            Click "Save current as new plan" to create your first cloud save.
          </p>
          <Button
            size="sm"
            onClick={() => setCreating(true)}
            className="bg-[#1B4332] hover:bg-[#145229] text-white gap-2"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            Save current plan
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {planList.map((plan) => (
            <PlanRow
              key={plan.id}
              plan={plan}
              isActive={plan.id === activePlanId}
              onLoad={handleLoad}
              onRename={handleRename}
              onDelete={handleDelete}
              loading={loadingPlanId === plan.id && getPlan.isLoading}
            />
          ))}
        </div>
      )}

      {/* Tip */}
      {planList.length > 0 && (
        <div className="mt-5 flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
          <Star className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700 leading-relaxed">
            <strong>Tip:</strong> Use multiple plans to compare scenarios — for example, "Retire at
            60" vs. "Retire at 65". Load a plan to make it active, then use Cloud Sync to keep it
            updated.
          </p>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this plan and all its version history. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => deleteTarget && deletePlan.mutate({ planId: deleteTarget.id })}
              disabled={deletePlan.isPending}
            >
              {deletePlan.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : null}
              Delete plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
