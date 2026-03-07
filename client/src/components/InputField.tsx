/**
 * InputField — Reusable form input components for Project Retire
 * Design: "Horizon" — Warm Modernist Financial Planning
 *
 * All numeric inputs use a local string state so the user can freely edit
 * (including deleting all characters) without the field snapping back.
 * The numeric value is only committed to the parent on blur.
 */

import { cn } from "@/lib/utils";
import React, { useEffect, useRef, useState } from "react";

// ─── Shared base styles ───────────────────────────────────────────────────────

const baseInput = cn(
  "w-full py-2.5 text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-lg",
  "focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332]",
  "transition-colors duration-150 tabular-nums"
);

// ─── CurrencyInput ────────────────────────────────────────────────────────────

interface CurrencyInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
  className?: string;
  min?: number;
  allowNegative?: boolean;
}

export function CurrencyInput({
  label,
  value,
  onChange,
  hint,
  className,
  min,
  allowNegative = false,
}: CurrencyInputProps) {
  // Local string state — always reflects what's in the <input>
  const [localStr, setLocalStr] = useState<string>(() =>
    value === 0 ? "" : String(value)
  );
  const isFocused = useRef(false);

  // Sync from parent only when the field is not being edited
  useEffect(() => {
    if (!isFocused.current) {
      setLocalStr(value === 0 ? "" : String(value));
    }
  }, [value]);

  const handleFocus = () => {
    isFocused.current = true;
    // Show raw number (no commas) when editing
    setLocalStr(value === 0 ? "" : String(value));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow digits, one decimal point, and optionally a leading minus
    const raw = allowNegative
      ? e.target.value.replace(/[^0-9.\-]/g, "")
      : e.target.value.replace(/[^0-9.]/g, "");
    setLocalStr(raw);
  };

  const handleBlur = () => {
    isFocused.current = false;
    const parsed = parseFloat(localStr.replace(/,/g, ""));
    let committed = isNaN(parsed) ? 0 : parsed;
    if (min !== undefined) committed = Math.max(min, committed);
    onChange(committed);
    // Show formatted value after blur
    setLocalStr(committed === 0 ? "" : String(committed));
  };

  // While focused show raw string; while blurred show comma-formatted number
  const displayValue = isFocused.current
    ? localStr
    : value === 0
    ? ""
    : value.toLocaleString("en-US");

  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium pointer-events-none">
          $
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          placeholder="0"
          className={cn(baseInput, "pl-7 pr-3")}
        />
      </div>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

// ─── PercentInput ─────────────────────────────────────────────────────────────

interface PercentInputProps {
  label: string;
  value: number; // stored as 0–1 decimal (e.g. 0.065 = 6.5%)
  onChange: (value: number) => void;
  hint?: string;
  className?: string;
  min?: number; // as decimal
  max?: number; // as decimal
  decimals?: number; // display decimal places
}

export function PercentInput({
  label,
  value,
  onChange,
  hint,
  className,
  min = 0,
  max = 1,
  decimals = 2,
}: PercentInputProps) {
  const pctValue = value * 100;
  const [localStr, setLocalStr] = useState<string>(() =>
    pctValue === 0 ? "" : pctValue.toFixed(decimals)
  );
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) {
      setLocalStr(pctValue === 0 ? "" : pctValue.toFixed(decimals));
    }
  }, [pctValue, decimals]);

  const handleFocus = () => {
    isFocused.current = true;
    setLocalStr(pctValue === 0 ? "" : pctValue.toFixed(decimals));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalStr(e.target.value.replace(/[^0-9.]/g, ""));
  };

  const handleBlur = () => {
    isFocused.current = false;
    const parsed = parseFloat(localStr);
    const pct = isNaN(parsed) ? 0 : parsed;
    const clamped = Math.min(max * 100, Math.max(min * 100, pct));
    onChange(clamped / 100);
    setLocalStr(clamped === 0 ? "" : clamped.toFixed(decimals));
  };

  const displayValue = isFocused.current
    ? localStr
    : pctValue === 0
    ? ""
    : pctValue.toFixed(decimals);

  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={displayValue}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          placeholder="0.00"
          className={cn(baseInput, "pl-3 pr-7")}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium pointer-events-none">
          %
        </span>
      </div>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

// ─── NumberInput ──────────────────────────────────────────────────────────────

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
  className?: string;
  min?: number;
  max?: number;
  suffix?: string;
  integer?: boolean; // if true, only allow whole numbers
}

export function NumberInput({
  label,
  value,
  onChange,
  hint,
  className,
  min = 0,
  max,
  suffix,
  integer = true,
}: NumberInputProps) {
  const [localStr, setLocalStr] = useState<string>(() =>
    value === 0 ? "" : String(value)
  );
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) {
      setLocalStr(value === 0 ? "" : String(value));
    }
  }, [value]);

  const handleFocus = () => {
    isFocused.current = true;
    setLocalStr(value === 0 ? "" : String(value));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = integer
      ? e.target.value.replace(/[^0-9]/g, "")
      : e.target.value.replace(/[^0-9.]/g, "");
    setLocalStr(raw);
  };

  const handleBlur = () => {
    isFocused.current = false;
    const parsed = integer ? parseInt(localStr, 10) : parseFloat(localStr);
    let committed = isNaN(parsed) ? 0 : parsed;
    committed = Math.max(min, committed);
    if (max !== undefined) committed = Math.min(max, committed);
    onChange(committed);
    setLocalStr(committed === 0 ? "" : String(committed));
  };

  const displayValue = isFocused.current
    ? localStr
    : value === 0
    ? ""
    : String(value);

  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
        {label}
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode={integer ? "numeric" : "decimal"}
          value={displayValue}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onChange={handleChange}
          placeholder="0"
          className={cn(baseInput, "pl-3", suffix ? "pr-10" : "pr-3")}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

// ─── SectionCard ──────────────────────────────────────────────────────────────

interface SectionCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function SectionCard({ title, description, children, className }: SectionCardProps) {
  return (
    <div className={cn("bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden", className)}>
      <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <h2 className="font-bold text-slate-800 text-base">{title}</h2>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
