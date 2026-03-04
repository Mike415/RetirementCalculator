/**
 * PlannerContext — Global state for the Retirement Planner
 * Design: "Horizon" — Warm Modernist Financial Planning
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  DEFAULT_INPUTS,
  ProjectionRow,
  RetirementInputs,
  runProjection,
} from "@/lib/projection";

interface PlannerContextValue {
  inputs: RetirementInputs;
  setInputs: React.Dispatch<React.SetStateAction<RetirementInputs>>;
  updateInput: <K extends keyof RetirementInputs>(key: K, value: RetirementInputs[K]) => void;
  projection: ProjectionRow[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const PlannerContext = createContext<PlannerContextValue | null>(null);

export function PlannerProvider({ children }: { children: React.ReactNode }) {
  const [inputs, setInputs] = useState<RetirementInputs>(DEFAULT_INPUTS);
  const [activeTab, setActiveTab] = useState("overview");

  const updateInput = useCallback(
    <K extends keyof RetirementInputs>(key: K, value: RetirementInputs[K]) => {
      setInputs((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const projection = useMemo(() => {
    try {
      return runProjection(inputs);
    } catch (e) {
      console.error("Projection error:", e);
      return [];
    }
  }, [inputs]);

  return (
    <PlannerContext.Provider value={{ inputs, setInputs, updateInput, projection, activeTab, setActiveTab }}>
      {children}
    </PlannerContext.Provider>
  );
}

export function usePlanner() {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error("usePlanner must be used within PlannerProvider");
  return ctx;
}
