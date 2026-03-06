/**
 * Accounts & Timeline — Dynamic multi-account management
 * Design: "Horizon" — Warm Modernist Financial Planning
 */

import { usePlanner } from "@/contexts/PlannerContext";
import { formatCurrency } from "@/lib/format";
import { Account, AccountType, aggregateAccounts } from "@/lib/projection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput, NumberInput, SectionCard } from "@/components/InputField";
import { cn } from "@/lib/utils";
import {
  Banknote, TrendingUp, Building2, Leaf, Shield, BookOpen, HelpCircle,
  Plus, Trash2, GripVertical
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
  account, defaultGrowthRate, onUpdate, onDelete,
}: {
  account: Account;
  defaultGrowthRate: number;
  onUpdate: (updated: Account) => void;
  onDelete: () => void;
}) {
  const meta = ACCOUNT_TYPE_META[account.type];
  const Icon = meta.icon;
  const hasOverride = account.growthRateOverride !== undefined && account.growthRateOverride !== null;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: account.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 50 : undefined };

  return (
    <div ref={setNodeRef} style={style} className={cn("flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 transition-colors", isDragging ? "shadow-lg border-slate-300" : "hover:border-slate-300")}>
      {/* Drag handle */}
      <button {...attributes} {...listeners} className="text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing flex-shrink-0 touch-none">
        <GripVertical className="w-4 h-4" />
      </button>
      {/* Type icon */}
      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0", meta.bgColor)}>
        <Icon className={cn("w-3.5 h-3.5", meta.color)} />
      </div>

      {/* Name */}
      <Input
        value={account.name}
        onChange={(e) => onUpdate({ ...account, name: e.target.value })}
        className="h-8 text-sm font-medium border border-slate-200 bg-white px-2 w-36 min-w-0 focus-visible:ring-1 focus-visible:ring-slate-300 rounded-lg"
        placeholder="Account name"
      />

      {/* Type dropdown */}
      <select
        value={account.type}
        onChange={(e) => onUpdate({ ...account, type: e.target.value as AccountType })}
        className="h-8 text-xs border border-slate-200 rounded-lg px-2 bg-white text-slate-600 focus:outline-none focus:ring-1 focus:ring-slate-300 flex-shrink-0"
      >
        {ACCOUNT_TYPES.map((t) => (
          <option key={t} value={t}>{ACCOUNT_TYPE_META[t].label}</option>
        ))}
      </select>

      {/* Balance */}
      <div className="relative flex-1 min-w-[110px]">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">$</span>
        <Input
          type="number"
          value={account.balance || ""}
          onChange={(e) => onUpdate({ ...account, balance: parseFloat(e.target.value) || 0 })}
          className="h-8 text-sm pl-6 pr-2"
          min={0}
          step={1000}
          placeholder="Balance"
        />
      </div>

      {/* Annual contribution (non-cash) */}
      {account.type !== "cash" && (
        <div className="relative min-w-[110px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">$/yr</span>
          <Input
            type="number"
            value={account.annualContribution ?? ""}
            onChange={(e) => onUpdate({ ...account, annualContribution: parseFloat(e.target.value) || 0 })}
            className="h-8 text-sm pl-8 pr-2"
            min={0}
            step={500}
            placeholder="Contrib."
          />
        </div>
      )}

      {/* Custom growth rate toggle + input */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {hasOverride ? (
          <div className="relative w-20">
            <Input
              type="number"
              value={((account.growthRateOverride ?? defaultGrowthRate) * 100).toFixed(1)}
              onChange={(e) => onUpdate({ ...account, growthRateOverride: (parseFloat(e.target.value) || 0) / 100 })}
              className="h-8 text-xs pr-5 pl-2"
              min={0} max={30} step={0.1}
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">%</span>
          </div>
        ) : (
          <span className="text-xs text-slate-400 whitespace-nowrap">{(defaultGrowthRate * 100).toFixed(1)}%</span>
        )}
        <button
          onClick={() => {
            if (hasOverride) { const { growthRateOverride: _r, ...rest } = account; onUpdate(rest as Account); }
            else { onUpdate({ ...account, growthRateOverride: defaultGrowthRate }); }
          }}
          className={cn("text-[10px] px-1.5 py-0.5 rounded border transition-colors flex-shrink-0",
            hasOverride
              ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
              : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
          )}
          title={hasOverride ? "Remove custom rate" : "Set custom growth rate"}
        >
          {hasOverride ? "custom" : "+rate"}
        </button>
      </div>

      {/* Delete */}
      <button onClick={onDelete} className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0 ml-auto">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}


export default function Accounts() {
  const { inputs, updateInput } = usePlanner();
  const accounts = inputs.accounts ?? [];

  const agg = aggregateAccounts(accounts);
  const totalInvestable = agg.currentCash + agg.currentInvestments + agg.current401k + agg.currentRoth401k + agg.currentRothIRA + agg.currentIRA;
  const homeEquity = inputs.homeValue - inputs.homeLoan;
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
            <p className="text-[10px] text-white/50 uppercase tracking-wide">Home Equity</p>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <NumberInput label="Current Age" value={inputs.currentAge} onChange={(v) => updateInput("currentAge", v)} min={18} max={80} suffix="yrs" integer />
          <NumberInput label="Retirement Age" value={inputs.retirementAge} onChange={(v) => updateInput("retirementAge", v)} min={inputs.currentAge + 1} max={80} suffix="yrs" integer />
          <NumberInput label="Project to Age" value={inputs.projectionEndAge} onChange={(v) => updateInput("projectionEndAge", v)} min={inputs.retirementAge + 1} max={100} suffix="yrs" integer />
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

      <SectionCard title="Home & Mortgage" description="Current home value, outstanding loan, and mortgage details.">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <CurrencyInput label="Home Value" value={inputs.homeValue} onChange={(v) => updateInput("homeValue", v)} />
          <CurrencyInput label="Mortgage Balance" value={inputs.homeLoan} onChange={(v) => updateInput("homeLoan", v)} />
          <NumberInput label="Mortgage Rate" value={inputs.mortgageRate * 100} onChange={(v) => updateInput("mortgageRate", v / 100)} suffix="%" min={0} max={20} />
          <NumberInput label="Loan Term" value={inputs.mortgageTotalYears} onChange={(v) => updateInput("mortgageTotalYears", v)} suffix="yrs" min={1} max={30} integer />
          <NumberInput label="Months Paid" value={inputs.mortgageElapsedMonths} onChange={(v) => updateInput("mortgageElapsedMonths", v)} suffix="mo" min={0} integer />
          <CurrencyInput label="Extra Monthly" value={inputs.extraMortgageMonthly} onChange={(v) => updateInput("extraMortgageMonthly", v)} />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <CurrencyInput label="Property Taxes / yr" value={inputs.propertyTaxesYear} onChange={(v) => updateInput("propertyTaxesYear", v)} />
          <CurrencyInput label="Home Insurance / yr" value={inputs.homeInsuranceYear} onChange={(v) => updateInput("homeInsuranceYear", v)} />
        </div>
      </SectionCard>
    </div>
  );
}
