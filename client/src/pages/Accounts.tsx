/**
 * Accounts & Timeline — Dynamic multi-account management
 * Design: "Horizon" — Warm Modernist Financial Planning
 */

import { useState } from "react";
import { usePlanner } from "@/contexts/PlannerContext";
import { formatCurrency } from "@/lib/format";
import { Account, AccountType, aggregateAccounts } from "@/lib/projection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput, NumberInput, SectionCard } from "@/components/InputField";
import { cn } from "@/lib/utils";
import {
  Banknote, TrendingUp, Building2, Leaf, Shield, BookOpen, HelpCircle,
  Plus, Trash2, GripVertical, Users
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const ACCOUNT_TYPE_META: Record<AccountType, {
  label: string;
  icon: React.ElementType;
  taxTreatment: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  cash: { label: "Cash / Savings", icon: Banknote, taxTreatment: "No growth tax", color: "text-slate-600", bgColor: "bg-slate-50", borderColor: "border-slate-200" },
  investment: { label: "Taxable Investment", icon: TrendingUp, taxTreatment: "Capital gains", color: "text-amber-700", bgColor: "bg-amber-50", borderColor: "border-amber-200" },
  "401k": { label: "401(k) — Traditional", icon: Building2, taxTreatment: "Tax-deferred", color: "text-blue-700", bgColor: "bg-blue-50", borderColor: "border-blue-200" },
  roth401k: { label: "Roth 401(k)", icon: Leaf, taxTreatment: "Tax-free growth", color: "text-green-700", bgColor: "bg-green-50", borderColor: "border-green-200" },
  rothIRA: { label: "Roth IRA", icon: Shield, taxTreatment: "Tax-free growth", color: "text-emerald-700", bgColor: "bg-emerald-50", borderColor: "border-emerald-200" },
  ira: { label: "Traditional IRA", icon: BookOpen, taxTreatment: "Tax-deferred", color: "text-violet-700", bgColor: "bg-violet-50", borderColor: "border-violet-200" },
  other: { label: "Other", icon: HelpCircle, taxTreatment: "Taxable", color: "text-rose-700", bgColor: "bg-rose-50", borderColor: "border-rose-200" },
};

const ACCOUNT_TYPES: AccountType[] = ["cash", "investment", "401k", "roth401k", "rothIRA", "ira", "other"];

function generateId() {
  return `acc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function AccountRow({
  account,
  defaultGrowthRate,
  onUpdate,
  onDelete,
}: {
  account: Account;
  defaultGrowthRate: number;
  onUpdate: (updated: Account) => void;
  onDelete: () => void;
}) {
  const meta = ACCOUNT_TYPE_META[account.type];
  const Icon = meta.icon;
  const hasOverride = account.growthRateOverride !== undefined && account.growthRateOverride !== null;
  const [rateStr, setRateStr] = useState<string | null>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: account.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 50 : undefined };
  const displayRate = ((hasOverride ? account.growthRateOverride! : defaultGrowthRate) * 100).toFixed(1);

  return (
    <div ref={setNodeRef} style={style} className={cn(
      "bg-white border border-slate-200 rounded-xl px-3 py-2.5 transition-colors space-y-2",
      isDragging ? "shadow-lg border-slate-300" : "hover:border-slate-300"
    )}>
      {/* Line 1: drag handle · type dropdown · name · delete */}
      <div className="flex items-center gap-2">
        <button {...attributes} {...listeners} className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing touch-none flex-shrink-0">
          <GripVertical className="w-4 h-4" />
        </button>
        <select
          value={account.type}
          onChange={(e) => onUpdate({ ...account, type: e.target.value as AccountType })}
          className="h-8 text-xs border border-slate-200 rounded-lg px-2 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-slate-300 flex-shrink-0 w-[140px] [font-size:16px]"
        >
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>{ACCOUNT_TYPE_META[t].label}</option>
          ))}
        </select>
        <Input
          value={account.name}
          onChange={(e) => onUpdate({ ...account, name: e.target.value })}
          className="h-8 text-sm font-medium border border-slate-200 bg-white px-2 focus-visible:ring-1 focus-visible:ring-slate-300 rounded-lg flex-1 min-w-0"
          placeholder="Account name"
        />
        <button onClick={onDelete} className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Line 2: balance · contribution · growth rate */}
      <div className="flex items-center gap-2 pl-6">
        {/* Balance */}
        <div className="relative flex-1 min-w-0">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">$</span>
          <Input
            type="number"
            value={account.balance || ""}
            onChange={(e) => onUpdate({ ...account, balance: parseFloat(e.target.value) || 0 })}
            className="h-8 text-sm pl-6 pr-2 w-full"
            min={0} step={1000} placeholder="Balance"
          />
        </div>
        {/* Contribution */}
        {account.type !== "cash" ? (
          <div className="relative flex-1 min-w-0">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">$/yr</span>
            <Input
              type="number"
              value={account.annualContribution ?? ""}
              onChange={(e) => onUpdate({ ...account, annualContribution: parseFloat(e.target.value) || 0 })}
              className="h-8 text-sm pl-10 pr-2 w-full"
              min={0} step={500} placeholder="Contrib."
            />
          </div>
        ) : (
          <div className="flex-1" />
        )}
        {/* Growth rate */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {hasOverride ? (
            <div className="relative w-[64px]">
              <Input
                type="text"
                inputMode="decimal"
                value={rateStr !== null ? rateStr : displayRate}
                onChange={(e) => {
                  setRateStr(e.target.value);
                  const parsed = parseFloat(e.target.value);
                  if (!isNaN(parsed)) onUpdate({ ...account, growthRateOverride: parsed / 100 });
                }}
                onBlur={() => setRateStr(null)}
                className="h-8 text-xs pr-5 pl-2 w-full [font-size:16px]"
                placeholder="Rate %"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">%</span>
            </div>
          ) : (
            <span className="text-xs text-slate-400 whitespace-nowrap w-[40px] text-right pr-1">{displayRate}%</span>
          )}
          <button
            onClick={() => {
              if (hasOverride) {
                setRateStr(null);
                const { growthRateOverride: _r, ...rest } = account;
                onUpdate(rest as Account);
              } else {
                onUpdate({ ...account, growthRateOverride: defaultGrowthRate });
              }
            }}
            className={cn("text-[10px] px-1.5 py-0.5 rounded border transition-colors flex-shrink-0 whitespace-nowrap",
              hasOverride
                ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
            )}
            title={hasOverride ? "Remove custom rate" : "Set custom growth rate"}
          >
            {hasOverride ? "custom" : "+rate"}
          </button>
        </div>
      </div>
    </div>
  );
}
export default function Accounts() {
  const { inputs, updateInput } = usePlanner();
  const accounts = inputs.accounts ?? [];

  const agg = aggregateAccounts(accounts);
  const totalInvestable = agg.currentCash + agg.currentInvestments + agg.current401k + agg.currentRoth401k + agg.currentRothIRA + agg.currentIRA;
  const additionalEquity = (inputs.additionalProperties ?? []).reduce(
    (sum, p) => sum + (p.homeValue - p.homeLoan),
    0
  );
  const homeEquity = (inputs.homeValue - inputs.homeLoan) + additionalEquity;
  const propertyCount = 1 + (inputs.additionalProperties?.length ?? 0);
  const totalNetWorth = totalInvestable + homeEquity;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = accounts.findIndex((a) => a.id === active.id);
      const newIndex = accounts.findIndex((a) => a.id === over.id);
      updateAccounts(arrayMove(accounts, oldIndex, newIndex));
    }
  };
  const updateAccounts = (updated: Account[]) => updateInput("accounts", updated);
  const addAccount = () => {
    const newAccount: Account = { id: generateId(), name: "New Account", type: "investment", balance: 0, annualContribution: 0 };
    updateAccounts([...accounts, newAccount]);
  };

  const updateAccount = (id: string, updated: Account) => updateAccounts(accounts.map((a) => (a.id === id ? updated : a)));
  const deleteAccount = (id: string) => updateAccounts(accounts.filter((a) => a.id !== id));

  const byType = accounts.reduce<Partial<Record<AccountType, number>>>((acc, a) => {
    acc[a.type] = (acc[a.type] ?? 0) + a.balance;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Accounts & Timeline</h1>
        <p className="text-sm text-slate-500 mt-1">Add accounts, set balances, contributions, and optional per-account growth rates.</p>
      </div>

      <div className="bg-gradient-to-r from-[#1B4332] to-[#2D6A4F] rounded-xl p-5 text-white">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Total Investable</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">{formatCurrency(totalInvestable, true)}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">
              Home Equity{propertyCount > 1 ? ` (${propertyCount})` : ""}
            </p>
            <p className="text-xl font-bold tabular-nums mt-0.5">{formatCurrency(homeEquity, true)}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Total Net Worth</p>
            <p className="text-xl font-bold tabular-nums mt-0.5">{formatCurrency(totalNetWorth, true)}</p>
          </div>
        </div>
        {Object.keys(byType).length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-3">
            {(Object.entries(byType) as [AccountType, number][]).map(([type, total]) => {
              const m = ACCOUNT_TYPE_META[type];
              return (
                <div key={type} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-white/40" />
                  <span className="text-[11px] text-white/70">{m.label}:</span>
                  <span className="text-[11px] text-white font-semibold tabular-nums">{formatCurrency(total, true)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <SectionCard title="Timeline" description="Set your current age, retirement target, and projection horizon.">
        {/* Primary person */}
        <div className="mb-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">You</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <NumberInput label="Current Age" value={inputs.currentAge} onChange={(v) => updateInput("currentAge", v)} min={18} max={80} suffix="yrs" integer />
            <NumberInput label="Retirement Age" value={inputs.retirementAge} onChange={(v) => updateInput("retirementAge", v)} min={inputs.currentAge + 1} max={80} suffix="yrs" integer />
            <NumberInput label="Project to Age" value={inputs.projectionEndAge} onChange={(v) => updateInput("projectionEndAge", v)} min={inputs.retirementAge + 1} max={100} suffix="yrs" integer />
          </div>
        </div>

        {/* Partner toggle */}
        <div className="border-t border-slate-100 pt-4 mt-2">
          <button
            onClick={() => updateInput("partnerEnabled", !inputs.partnerEnabled)}
            className={cn(
              "flex items-center gap-2.5 px-4 py-2.5 rounded-lg border text-sm font-semibold transition-all",
              inputs.partnerEnabled
                ? "bg-[#1B4332] border-[#1B4332] text-white"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
            )}
          >
            <Users className="w-4 h-4" />
            {inputs.partnerEnabled ? "Partner / Spouse Enabled" : "Add Partner / Spouse"}
          </button>

          {inputs.partnerEnabled && (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-3">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Partner</p>
                <Input
                  value={inputs.partnerName}
                  onChange={(e) => updateInput("partnerName", e.target.value)}
                  placeholder="Partner name"
                  className="h-7 text-sm max-w-[160px] border-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <NumberInput label="Partner Age" value={inputs.partnerCurrentAge} onChange={(v) => updateInput("partnerCurrentAge", v)} min={18} max={80} suffix="yrs" integer />
                <NumberInput label="Retirement Age" value={inputs.partnerRetirementAge} onChange={(v) => updateInput("partnerRetirementAge", v)} min={inputs.partnerCurrentAge + 1} max={80} suffix="yrs" integer />
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Accounts ({accounts.length})</h2>
          <Button onClick={addAccount} size="sm" className="bg-[#1B4332] hover:bg-[#2D6A4F] text-white gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add Account
          </Button>
        </div>
        {accounts.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
            <TrendingUp className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">No accounts yet</p>
            <p className="text-xs text-slate-400 mt-1">Click "Add Account" to get started</p>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={accounts.map((a) => a.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {accounts.map((account) => (
                  <AccountRow key={account.id} account={account} defaultGrowthRate={inputs.investmentGrowthRate}
                    onUpdate={(updated) => updateAccount(account.id, updated)}
                    onDelete={() => deleteAccount(account.id)} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Contribution Limits Reference */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-5">
        <div>
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#1B4332] text-white text-[10px] flex items-center justify-center font-bold">i</span>
            2026 Contribution Limits
          </h3>
          <p className="text-xs text-slate-500 mt-1">IRS limits for the 2026 tax year. Catch-up limits apply to age 50+ (age 60–63 gets a higher SECURE 2.0 super catch-up for 401k).</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* 401k / 403b */}
          <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">401(k) / 403(b)</p>
            <div className="space-y-1 text-xs text-slate-600">
              <div className="flex justify-between"><span>Employee deferral (under 50)</span><span className="font-semibold tabular-nums">$24,500</span></div>
              <div className="flex justify-between"><span>Catch-up (age 50–59, 64+)</span><span className="font-semibold tabular-nums">+$8,000</span></div>
              <div className="flex justify-between"><span className="font-medium text-blue-800">Super catch-up (age 60–63)</span><span className="font-semibold tabular-nums text-blue-800">+$11,250</span></div>
              <div className="flex justify-between border-t border-slate-100 pt-1 mt-1"><span>Total 415(c) limit (employee + employer)</span><span className="font-semibold tabular-nums">$72,000</span></div>
            </div>
          </div>

          {/* IRA */}
          <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Roth IRA / Traditional IRA</p>
            <div className="space-y-1 text-xs text-slate-600">
              <div className="flex justify-between"><span>Annual limit (under 50)</span><span className="font-semibold tabular-nums">$7,500</span></div>
              <div className="flex justify-between"><span>Catch-up (age 50+)</span><span className="font-semibold tabular-nums">+$1,000</span></div>
              <div className="flex justify-between border-t border-slate-100 pt-1 mt-1"><span>Roth IRA phase-out (single)</span><span className="font-semibold tabular-nums">$150k–$165k</span></div>
              <div className="flex justify-between"><span>Roth IRA phase-out (MFJ)</span><span className="font-semibold tabular-nums">$236k–$246k</span></div>
            </div>
          </div>
        </div>

        {/* Mega Backdoor */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-2">Mega Backdoor Roth (2026)</p>
          <p className="text-xs text-amber-700 mb-3">If your 401(k) plan allows after-tax contributions and in-service withdrawals (or in-plan Roth conversions), you can contribute far beyond the standard deferral limit.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-lg p-2.5 border border-amber-200">
              <p className="text-[10px] text-amber-600 uppercase tracking-wide font-semibold">Under 50</p>
              <p className="text-base font-bold text-amber-900 tabular-nums mt-0.5">$47,500</p>
              <p className="text-[10px] text-amber-600 mt-0.5">$72k total − $24,500 deferral</p>
            </div>
            <div className="bg-white rounded-lg p-2.5 border border-amber-200">
              <p className="text-[10px] text-amber-600 uppercase tracking-wide font-semibold">Age 50–59, 64+</p>
              <p className="text-base font-bold text-amber-900 tabular-nums mt-0.5">$39,500</p>
              <p className="text-[10px] text-amber-600 mt-0.5">$72k total − $32,500 deferrals</p>
            </div>
            <div className="bg-white rounded-lg p-2.5 border border-amber-200">
              <p className="text-[10px] text-amber-600 uppercase tracking-wide font-semibold">Age 60–63</p>
              <p className="text-base font-bold text-amber-900 tabular-nums mt-0.5">$36,250</p>
              <p className="text-[10px] text-amber-600 mt-0.5">$72k total − $35,750 deferrals</p>
            </div>
          </div>
          <p className="text-[10px] text-amber-600 mt-3"><strong>How it works:</strong> Contribute after-tax dollars to your 401(k) up to the 415(c) limit, then immediately convert to Roth (in-plan conversion) or roll out to a Roth IRA. Earnings must be converted promptly to avoid taxable growth. Requires plan support — check with your HR/plan administrator.</p>
        </div>

        <p className="text-[10px] text-slate-400">Limits are for the 2026 tax year per IRS Notice 2025-82. Consult a tax advisor for your specific situation.</p>
      </div>
    </div>
  );
}
