/**
 * PlannerContext — Global state for the Retirement Planner
 * Design: "Horizon" — Warm Modernist Financial Planning
 *
 * Persistence: all inputs are saved to localStorage on every change and
 * restored on page load. A deep-merge with DEFAULT_INPUTS ensures that
 * newly added fields always have a valid default even when loading older
 * saved data (schema-safe).
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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
  setInputs: React.Dispatch<React.SetStateAction<RetirementInputs>>;
  updateInput: <K extends keyof RetirementInputs>(key: K, value: RetirementInputs[K]) => void;
  resetToDefaults: () => void;
  projection: ProjectionRow[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const PlannerContext = createContext<PlannerContextValue | null>(null);

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  // Load from localStorage on first render (lazy initializer)
  const [inputs, setInputs] = useState<RetirementInputs>(loadFromStorage);
  const [activeTab, setActiveTab] = useState("overview");

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
      value={{ inputs, setInputs, updateInput, resetToDefaults, projection, activeTab, setActiveTab }}
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
