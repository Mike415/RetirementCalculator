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
import { Switch } from "@/components/ui/switch";
import { CurrencyInput, NumberInput, SectionCard } from "@/components/InputField";
import { cn } from "@/lib/utils";
import {
  Banknote, TrendingUp, Building2, Leaf, Shield, BookOpen, HelpCircle,
  Plus, Trash2, ChevronDown, ChevronUp, Pencil, Check, X
} from "lucide-react";

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
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(account.name);

  const meta = ACCOUNT_TYPE_META[account.type];
  const Icon = meta.icon;
  const hasOverride = account.growthRateOverride !== undefined && account.growthRateOverride !== null;
  const effectiveRate = hasOverride ? account.growthRateOverride! : defaultGrowthRate;

  const saveName = () => {
    if (nameInput.trim()) onUpdate({ ...account, name: nameInput.trim() });
    setEditingName(false);
  };

  return (
    <div className={cn("rounded-xl border transition-all", meta.borderColor, expanded ? "shadow-sm" : "")}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", meta.bgColor)}>
          <Icon className={cn("w-4 h-4", meta.color)} />
        </div>
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-1.5">
              <Input value={nameInput} onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
                className="h-7 text-sm py-0 px-2 w-full max-w-[180px]" autoFocus />
              <button onClick={saveName} className="text-emerald-600 hover:text-emerald-700"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => { setNameInput(account.name); setEditingName(false); }} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group">
              <span className="text-sm font-semibold text-slate-800 truncate">{account.name}</span>
              <button onClick={() => { setNameInput(account.name); setEditingName(true); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600">
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn("text-[10px] font-medium uppercase tracking-wide", meta.color)}>{meta.label}</span>
            <span className="text-[10px] text-slate-400">·</span>
            <span className="text-[10px] text-slate-400">{meta.taxTreatment}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-sm font-bold tabular-nums text-slate-800">{formatCurrency(account.balance, true)}</p>
          <p className="text-[10px] text-slate-400">{(effectiveRate * 100).toFixed(1)}% growth{hasOverride ? " (custom)" : ""}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 px-4 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Account Type</label>
              <div className="grid grid-cols-2 gap-1.5">
                {ACCOUNT_TYPES.map((t) => {
                  const m = ACCOUNT_TYPE_META[t];
                  const TIcon = m.icon;
                  return (
                    <button key={t} onClick={() => onUpdate({ ...account, type: t })}
                      className={cn("flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-medium transition-all",
                        account.type === t ? `${m.bgColor} ${m.color} ${m.borderColor}` : "bg-white text-slate-500 border-slate-200 hover:border-slate-300")}>
                      <TIcon className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Current Balance</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                  <Input type="number" value={account.balance || ""}
                    onChange={(e) => onUpdate({ ...account, balance: parseFloat(e.target.value) || 0 })}
                    className="pl-7 text-sm" min={0} step={1000} />
                </div>
              </div>
              {account.type !== "cash" && (
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 block">Annual Contribution</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <Input type="number" value={account.annualContribution ?? ""}
                      onChange={(e) => onUpdate({ ...account, annualContribution: parseFloat(e.target.value) || 0 })}
                      className="pl-7 text-sm" min={0} step={500} placeholder="0" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Pre-retirement only</p>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Custom Growth Rate</label>
                  <Switch checked={hasOverride} onCheckedChange={(checked) => {
                    if (checked) { onUpdate({ ...account, growthRateOverride: defaultGrowthRate }); }
                    else { const { growthRateOverride: _r, ...rest } = account; onUpdate(rest as Account); }
                  }} />
                </div>
                {hasOverride ? (
                  <div className="flex items-center gap-2">
                    <Input type="number" value={((account.growthRateOverride ?? defaultGrowthRate) * 100).toFixed(1)}
                      onChange={(e) => onUpdate({ ...account, growthRateOverride: (parseFloat(e.target.value) || 0) / 100 })}
                      className="text-sm w-24" min={0} max={30} step={0.1} />
                    <span className="text-sm text-slate-500">% per year</span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Using default: {(defaultGrowthRate * 100).toFixed(1)}% (from Assumptions)</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
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
          <div className="space-y-2">
            {accounts.map((account) => (
              <AccountRow key={account.id} account={account} defaultGrowthRate={inputs.investmentGrowthRate}
                onUpdate={(updated) => updateAccount(account.id, updated)}
                onDelete={() => deleteAccount(account.id)} />
            ))}
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
