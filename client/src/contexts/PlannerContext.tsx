/**
 * PlannerContext — Global state for the Retirement Planner
 * Design: "Horizon" — Warm Modernist Financial Planning
 *
 * Persistence: all inputs are saved to localStorage on every change and
 * restored on page load. A deep-merge with DEFAULT_INPUTS ensures that
 * newly added fields always have a valid default even when loading older
 * saved data (schema-safe).
 */

import { Dispatch, SetStateAction, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  BudgetItem,
  BudgetPeriod,
  DEFAULT_INPUTS,
  ProjectionRow,
  RetirementInputs,
  runProjection,
} from "@/lib/projection";

// ─── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = "retirement-planner-v1";

/**
 * Deep-merge saved data on top of defaults so that:
 * - Any field added to DEFAULT_INPUTS after the user first saved will
 *   still get its default value (not undefined).
 * - Existing saved values are preserved.
 * - Budget periods are merged item-by-item so new default items appear
 *   in existing saves.
 */
function mergeWithDefaults(saved: Partial<RetirementInputs>): RetirementInputs {
  const base: RetirementInputs = { ...DEFAULT_INPUTS, ...saved };

  // Ensure new fields added after first save always get their defaults
  if (base.socialSecurityEnabled === undefined) base.socialSecurityEnabled = DEFAULT_INPUTS.socialSecurityEnabled;
  if (base.socialSecurityStartAge === undefined) base.socialSecurityStartAge = DEFAULT_INPUTS.socialSecurityStartAge;
  if (base.socialSecurityMonthly === undefined) base.socialSecurityMonthly = DEFAULT_INPUTS.socialSecurityMonthly;
  if (!Array.isArray(base.oneTimeEvents)) base.oneTimeEvents = DEFAULT_INPUTS.oneTimeEvents;
  // New contribution fields added in audit fix
  if (base.k401Contribution === undefined) base.k401Contribution = DEFAULT_INPUTS.k401Contribution;
  if (base.iraContribution === undefined) base.iraContribution = DEFAULT_INPUTS.iraContribution;

  // Merge budget periods: use saved periods if present, else defaults
  if (saved.budgetPeriods && Array.isArray(saved.budgetPeriods)) {
    base.budgetPeriods = saved.budgetPeriods.map((savedPeriod: BudgetPeriod, pi: number) => {
      const defaultPeriod = DEFAULT_INPUTS.budgetPeriods[pi] ?? savedPeriod;
      return {
        ...defaultPeriod,
        ...savedPeriod,
        // Merge items: keep saved items, fall back to default items for any missing
        items: savedPeriod.items && savedPeriod.items.length > 0
          ? savedPeriod.items.map((savedItem: BudgetItem, ii: number) => {
              const defaultItem = defaultPeriod.items[ii] ?? savedItem;
              return {
                ...defaultItem,
                ...savedItem,
                amounts: savedItem.amounts ?? defaultItem.amounts,
              };
            })
          : defaultPeriod.items,
      };
    });
  }

  return base;
}

function loadFromStorage(): RetirementInputs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_INPUTS;
    const parsed = JSON.parse(raw) as Partial<RetirementInputs>;
    return mergeWithDefaults(parsed);
  } catch {
    // Corrupted data — fall back to defaults
    return DEFAULT_INPUTS;
  }
}

function saveToStorage(inputs: RetirementInputs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inputs));
  } catch {
    // Storage quota exceeded or private browsing — silently ignore
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface PlannerContextValue {
  inputs: RetirementInputs;
  setInputs: Dispatch<SetStateAction<RetirementInputs>>;
  updateInput: <K extends keyof RetirementInputs>(key: K, value: RetirementInputs[K]) => void;
  resetToDefaults: () => void;
  exportPlan: () => void;
  importPlan: (file: File) => Promise<{ ok: boolean; error?: string }>;
  projection: ProjectionRow[];
}

const PlannerContext = createContext<PlannerContextValue | null>(null);

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  // Load from localStorage on first render (lazy initializer)
  const [inputs, setInputs] = useState<RetirementInputs>(loadFromStorage);

  // Persist to localStorage whenever inputs change
  useEffect(() => {
    saveToStorage(inputs);
  }, [inputs]);

  const updateInput = useCallback(
    <K extends keyof RetirementInputs>(key: K, value: RetirementInputs[K]) => {
      setInputs((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const resetToDefaults = useCallback(() => {
    setInputs(DEFAULT_INPUTS);
  }, []);

  // ── Export: download current inputs as a JSON file ──────────────────────────
  const exportPlan = useCallback(() => {
    const payload = {
      _version: 1,
      _exported: new Date().toISOString(),
      inputs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Filename: retirement-plan-YYYY-MM-DD.json
    const date = new Date().toISOString().slice(0, 10);
    a.download = `retirement-plan-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [inputs]);

  // ── Import: read a JSON file and load inputs (with schema-safe merge) ────────
  const importPlan = useCallback((file: File): Promise<{ ok: boolean; error?: string }> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const parsed = JSON.parse(text);
          // Accept either { inputs: {...} } wrapper or a raw RetirementInputs object
          const raw: Partial<RetirementInputs> =
            parsed?.inputs && typeof parsed.inputs === "object"
              ? parsed.inputs
              : parsed;
          if (typeof raw !== "object" || raw === null) {
            resolve({ ok: false, error: "Invalid file format." });
            return;
          }
          const merged = mergeWithDefaults(raw);
          setInputs(merged);
          resolve({ ok: true });
        } catch {
          resolve({ ok: false, error: "Could not parse file. Make sure it is a valid retirement plan JSON." });
        }
      };
      reader.onerror = () => resolve({ ok: false, error: "Failed to read file." });
      reader.readAsText(file);
    });
  }, []);

  const projection = useMemo(() => {
    try {
      return runProjection(inputs);
    } catch (e) {
      console.error("Projection error:", e);
      return [];
    }
  }, [inputs]);

  return (
    <PlannerContext.Provider
      value={{ inputs, setInputs, updateInput, resetToDefaults, exportPlan, importPlan, projection }}
    >
      {children}
    </PlannerContext.Provider>
  );
}

export function usePlanner() {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error("usePlanner must be used within PlannerProvider");
  return ctx;
}
