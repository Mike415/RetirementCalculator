/**
 * InputField — Reusable form input components for the Retirement Planner
 * Design: "Horizon" — Warm Modernist Financial Planning
 */

import { cn } from "@/lib/utils";
import React, { useCallback, useState } from "react";

interface CurrencyInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
  className?: string;
  min?: number;
  max?: number;
}

export function CurrencyInput({
  label,
  value,
  onChange,
  hint,
  className,
  min = 0,
}: CurrencyInputProps) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState("");

  const displayValue = focused
    ? raw
    : value === 0
    ? ""
    : value.toLocaleString("en-US");

  const handleFocus = useCallback(() => {
    setFocused(true);
    setRaw(value === 0 ? "" : String(value));
  }, [value]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    const parsed = parseFloat(raw.replace(/,/g, "")) || 0;
    onChange(Math.max(min, parsed));
  }, [raw, onChange, min]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRaw(e.target.value.replace(/[^0-9.,]/g, ""));
  }, []);

  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
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
          className={cn(
            "w-full pl-7 pr-3 py-2.5 text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-lg",
            "focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332]",
            "transition-colors duration-150 tabular-nums"
          )}
        />
      </div>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

interface PercentInputProps {
  label: string;
  value: number; // 0–1 decimal
  onChange: (value: number) => void;
  hint?: string;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
}

export function PercentInput({
  label,
  value,
  onChange,
  hint,
  className,
  min = 0,
  max = 1,
  step = 0.001,
}: PercentInputProps) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState("");

  const pct = value * 100;
  const displayValue = focused ? raw : pct === 0 ? "" : pct.toFixed(1);

  const handleFocus = useCallback(() => {
    setFocused(true);
    setRaw(pct === 0 ? "" : pct.toFixed(1));
  }, [pct]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    const parsed = parseFloat(raw) || 0;
    const clamped = Math.min(max * 100, Math.max(min * 100, parsed));
    onChange(clamped / 100);
  }, [raw, onChange, min, max]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRaw(e.target.value.replace(/[^0-9.]/g, ""));
  }, []);

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
          placeholder="0.0"
          className={cn(
            "w-full pl-3 pr-7 py-2.5 text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-lg",
            "focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332]",
            "transition-colors duration-150 tabular-nums"
          )}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">
          %
        </span>
      </div>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

interface NumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: string;
  className?: string;
  min?: number;
  max?: number;
  suffix?: string;
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
}: NumberInputProps) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = parseInt(e.target.value, 10);
      if (!isNaN(parsed)) {
        const clamped = max !== undefined ? Math.min(max, Math.max(min, parsed)) : Math.max(min, parsed);
        onChange(clamped);
      }
    },
    [onChange, min, max]
  );

  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={handleChange}
          min={min}
          max={max}
          className={cn(
            "w-full pl-3 pr-3 py-2.5 text-sm font-medium text-slate-800 bg-white border border-slate-200 rounded-lg",
            "focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332]",
            "transition-colors duration-150 tabular-nums",
            suffix && "pr-10"
          )}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

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
