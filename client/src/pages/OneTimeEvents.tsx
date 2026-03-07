/**
 * One-Time Events — Irregular cash flows at specific ages
 * Design: "Horizon" — Warm Modernist Financial Planning
 *
 * Mobile-first: each event is a card with stacked fields on small screens.
 * On md+ screens the table grid is shown.
 */

import { usePlanner } from "@/contexts/PlannerContext";
import { formatCurrency } from "@/lib/format";
import { OneTimeEvent } from "@/lib/projection";
import { cn } from "@/lib/utils";
import { ArrowDownCircle, ArrowUpCircle, Plus, Trash2 } from "lucide-react";
import { nanoid } from "nanoid";
import React, { useEffect, useRef, useState } from "react";

// ─── Inline editable cell components ─────────────────────────────────────────

interface EditableNumberProps {
  value: number;
  onChange: (v: number) => void;
  integer?: boolean;
  className?: string;
  placeholder?: string;
}

function EditableNumber({ value, onChange, integer = false, className, placeholder }: EditableNumberProps) {
  const [local, setLocal] = useState(value === 0 ? "" : String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setLocal(value === 0 ? "" : String(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      value={focused.current ? local : value === 0 ? "" : String(value)}
      placeholder={placeholder ?? "0"}
      onFocus={() => { focused.current = true; setLocal(value === 0 ? "" : String(value)); }}
      onChange={(e) => setLocal(e.target.value.replace(integer ? /[^0-9]/g : /[^0-9.\-]/g, ""))}
      onBlur={() => {
        focused.current = false;
        const parsed = integer ? parseInt(local, 10) : parseFloat(local);
        const committed = isNaN(parsed) ? 0 : parsed;
        onChange(committed);
        setLocal(committed === 0 ? "" : String(committed));
      }}
      className={className}
    />
  );
}

// ─── Preset events ────────────────────────────────────────────────────────────

const PRESETS: Array<Omit<OneTimeEvent, "id">> = [
  { age: 40, label: "New Car",          amount: -35000,  account: "investments" },
  { age: 45, label: "Home Renovation",  amount: -50000,  account: "investments" },
  { age: 55, label: "Inheritance",      amount: 150000,  account: "investments" },
  { age: 60, label: "Sell Home",        amount: 300000,  account: "investments" },
  { age: 65, label: "Pension Lump Sum", amount: 200000,  account: "investments" },
  { age: 70, label: "Medical Expense",  amount: -25000,  account: "cash"        },
];

// ─── Single event row — card on mobile, grid row on desktop ──────────────────

interface EventRowProps {
  event: OneTimeEvent;
  currentAge: number;
  onUpdate: <K extends keyof OneTimeEvent>(key: K, value: OneTimeEvent[K]) => void;
  onRemove: () => void;
}

function EventRow({ event, currentAge, onUpdate, onRemove }: EventRowProps) {
  const isInflow = event.amount >= 0;

  return (
    <>
      {/* ── Mobile card ── */}
      <div className="md:hidden px-4 py-3 border-t border-slate-50">
        <div className="flex items-start gap-3">
          {/* Inflow/outflow icon */}
          <div className="flex-shrink-0 mt-1">
            {isInflow
              ? <ArrowUpCircle className="w-4 h-4 text-emerald-500" />
              : <ArrowDownCircle className="w-4 h-4 text-red-400" />}
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            {/* Label */}
            <input
              type="text"
              value={event.label}
              onChange={(e) => onUpdate("label", e.target.value)}
              className="w-full text-sm font-semibold text-slate-800 bg-transparent border-0 border-b border-slate-200 focus:outline-none focus:border-[#1B4332] pb-0.5"
              placeholder="Event name"
            />

            {/* Age + Amount row */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Age</span>
                <EditableNumber
                  value={event.age}
                  onChange={(v) => onUpdate("age", Math.max(currentAge, v))}
                  integer
                  className="w-14 text-sm font-semibold text-slate-800 text-center bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-[#1B4332]"
                  placeholder="0"
                />
              </div>

              <div className="flex-1 relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">$</span>
                <EditableNumber
                  value={event.amount}
                  onChange={(v) => onUpdate("amount", v)}
                  className={cn(
                    "w-full pl-6 pr-3 py-1.5 text-sm font-semibold tabular-nums rounded-lg border focus:outline-none",
                    isInflow
                      ? "text-emerald-700 bg-emerald-50 border-emerald-200 focus:border-emerald-400"
                      : "text-red-600 bg-red-50 border-red-200 focus:border-red-400"
                  )}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Account selector */}
            <select
              value={event.account}
              onChange={(e) => onUpdate("account", e.target.value as OneTimeEvent["account"])}
              className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#1B4332]"
            >
              <option value="investments">Investments</option>
              <option value="cash">Cash</option>
            </select>
          </div>

          {/* Delete */}
          <button
            onClick={onRemove}
            className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors mt-0.5"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Desktop table row ── */}
      <div
        className="hidden md:grid items-center px-6 py-2.5 border-t border-slate-50 hover:bg-slate-50/50 transition-colors"
        style={{ gridTemplateColumns: "60px 1fr 140px 120px 32px" }}
      >
        {/* Age */}
        <EditableNumber
          value={event.age}
          onChange={(v) => onUpdate("age", Math.max(currentAge, v))}
          integer
          className="w-14 text-sm font-semibold text-slate-800 bg-transparent border-0 focus:outline-none focus:bg-white focus:border focus:border-slate-200 rounded px-1 py-0.5 tabular-nums"
        />

        {/* Label */}
        <input
          type="text"
          value={event.label}
          onChange={(e) => onUpdate("label", e.target.value)}
          className="text-sm text-slate-700 bg-transparent border-0 focus:outline-none focus:bg-white focus:border focus:border-slate-200 rounded px-1 py-0.5 -mx-1 w-full mr-2"
        />

        {/* Amount */}
        <div className="flex items-center gap-1.5">
          {isInflow
            ? <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
            : <ArrowDownCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
          <div className="relative flex-1">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">$</span>
            <EditableNumber
              value={event.amount}
              onChange={(v) => onUpdate("amount", v)}
              className={cn(
                "w-full pl-5 pr-2 py-1 text-xs font-semibold tabular-nums rounded border focus:outline-none",
                isInflow
                  ? "text-emerald-700 bg-emerald-50 border-emerald-200 focus:border-emerald-400"
                  : "text-red-600 bg-red-50 border-red-200 focus:border-red-400"
              )}
              placeholder="0"
            />
          </div>
        </div>

        {/* Account */}
        <select
          value={event.account}
          onChange={(e) => onUpdate("account", e.target.value as OneTimeEvent["account"])}
          className="text-xs text-slate-700 bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-[#1B4332] ml-2"
        >
          <option value="investments">Investments</option>
          <option value="cash">Cash</option>
        </select>

        {/* Delete */}
        <button
          onClick={onRemove}
          className="flex items-center justify-center w-7 h-7 rounded text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OneTimeEvents() {
  const { inputs, updateInput, projection } = usePlanner();
  const events = inputs.oneTimeEvents ?? [];

  const totalInflows  = events.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
  const totalOutflows = events.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0);

  const addEvent = (preset?: Omit<OneTimeEvent, "id">) => {
    const newEvent: OneTimeEvent = preset
      ? { ...preset, id: nanoid(8) }
      : {
          id: nanoid(8),
          age: inputs.currentAge + 10,
          label: "New Event",
          amount: 0,
          account: "investments",
        };
    updateInput("oneTimeEvents", [...events, newEvent]);
  };

  const updateEvent = <K extends keyof OneTimeEvent>(id: string, key: K, value: OneTimeEvent[K]) => {
    updateInput(
      "oneTimeEvents",
      events.map((e) => (e.id === id ? { ...e, [key]: value } : e))
    );
  };

  const removeEvent = (id: string) => {
    updateInput("oneTimeEvents", events.filter((e) => e.id !== id));
  };

  const sortedEvents = [...events].sort((a, b) => a.age - b.age);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">One-Time Events</h1>
        <p className="text-sm text-slate-500 mt-1">
          Add irregular cash flows at specific ages — inheritances, large purchases, home sales,
          medical expenses. Positive amounts add to your accounts; negative amounts subtract.
        </p>
      </div>

      {/* Summary */}
      {events.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">Events</p>
            <p className="text-2xl font-bold text-slate-800 mt-0.5">{events.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className="text-[10px] text-emerald-600 uppercase tracking-wide">Inflows</p>
            <p className="text-lg font-bold text-emerald-700 mt-0.5 tabular-nums leading-tight">
              +{formatCurrency(totalInflows, true)}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <p className="text-[10px] text-red-500 uppercase tracking-wide">Outflows</p>
            <p className="text-lg font-bold text-red-600 mt-0.5 tabular-nums leading-tight">
              {formatCurrency(totalOutflows, true)}
            </p>
          </div>
        </div>
      )}

      {/* Events list */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-bold text-slate-800 text-base">Events</h2>
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">
              Applied to the specified account at the start of that age's projection year.
            </p>
          </div>
          <button
            onClick={() => addEvent()}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-[#1B4332] text-white text-xs font-semibold rounded-lg hover:bg-[#2D6A4F] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Event
          </button>
        </div>

        {events.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <Plus className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-600">No events yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Add events manually or pick from the presets below.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop column headers */}
            <div
              className="hidden md:grid items-center px-6 py-2 bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wide"
              style={{ gridTemplateColumns: "60px 1fr 140px 120px 32px" }}
            >
              <span>Age</span>
              <span>Description</span>
              <span>Amount</span>
              <span>Account</span>
              <span></span>
            </div>

            {sortedEvents.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                currentAge={inputs.currentAge}
                onUpdate={(key, value) => updateEvent(event.id, key, value)}
                onRemove={() => removeEvent(event.id)}
              />
            ))}
          </>
        )}

        {/* Add row footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-100">
          <button
            onClick={() => addEvent()}
            className="flex items-center gap-2 text-sm text-[#1B4332] font-medium hover:text-[#2D6A4F] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Event
          </button>
        </div>
      </div>

      {/* Presets */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-bold text-slate-800 mb-1">Quick Add Presets</h2>
        <p className="text-xs text-slate-500 mb-4">
          Click to add a preset event. You can edit all values after adding.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PRESETS.map((preset) => {
            const isInflow = preset.amount >= 0;
            return (
              <button
                key={preset.label}
                onClick={() => addEvent(preset)}
                className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 hover:border-[#1B4332]/30 hover:bg-slate-50 text-left transition-all group"
              >
                {isInflow
                  ? <ArrowUpCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  : <ArrowDownCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />}
                <div>
                  <p className="text-xs font-semibold text-slate-700 group-hover:text-slate-900">
                    {preset.label}
                  </p>
                  <p className={cn(
                    "text-[10px] tabular-nums font-medium mt-0.5",
                    isInflow ? "text-emerald-600" : "text-red-500"
                  )}>
                    {isInflow ? "+" : ""}{formatCurrency(preset.amount)} at age {preset.age}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Timeline preview */}
      {events.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <h2 className="font-bold text-slate-800 mb-3">Timeline Preview</h2>
          <div className="space-y-1">
            {projection
              .filter((r) => r.oneTimeEventAmount !== 0)
              .map((r) => (
                <div key={r.age} className="flex items-center gap-3 py-1.5 border-b border-slate-50 last:border-0 flex-wrap">
                  <span className="text-xs font-bold text-slate-500 w-16 flex-shrink-0">Age {r.age}</span>
                  <span className="text-xs text-slate-500 w-14 flex-shrink-0">{r.year}</span>
                  <span className={cn(
                    "text-xs font-semibold tabular-nums",
                    r.oneTimeEventAmount >= 0 ? "text-emerald-700" : "text-red-600"
                  )}>
                    {r.oneTimeEventAmount >= 0 ? "+" : ""}{formatCurrency(r.oneTimeEventAmount)}
                  </span>
                  <span className="text-xs text-slate-400 min-w-0 truncate">
                    {events.filter((e) => e.age === r.age).map((e) => e.label).join(", ")}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
