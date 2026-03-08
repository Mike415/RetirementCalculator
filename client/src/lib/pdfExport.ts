/**
 * PDF Export Utilities — Project Retire
 *
 * Two export modes:
 *   exportSummaryPDF  — One-page executive summary (Basic+)
 *   exportDataTablePDF — Year-by-year data table + CSV (Pro)
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { RetirementInputs, ProjectionRow } from "./projection";

// ─── Formatting helpers ────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtFull(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

// Brand colors
const GREEN = "#1B4332";
const LIGHT_GREEN = "#2D6A4F";
const CREAM = "#F9F5F0";
const SLATE = "#475569";
const SLATE_LIGHT = "#94A3B8";

// ─── Summary PDF (Basic+) ──────────────────────────────────────────────────────

export function exportSummaryPDF(
  planName: string,
  inputs: RetirementInputs,
  projection: ProjectionRow[]
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // ── Background ──
  doc.setFillColor(CREAM);
  doc.rect(0, 0, W, H, "F");

  // ── Header bar ──
  doc.setFillColor(GREEN);
  doc.rect(0, 0, W, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Project Retire", 14, 12);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Retirement Projection Summary", 14, 19);

  // Plan name + date
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  doc.setFontSize(8);
  doc.text(`${planName}  •  Generated ${today}`, W - 14, 19, { align: "right" });

  // ── Key metrics ──
  const retirementRow = projection.find((r) => r.age === inputs.retirementAge) ?? projection[0];
  const lastRow = projection[projection.length - 1];
  const peakNW = Math.max(...projection.map((r) => r.netWorth));
  const runsOut = projection.find((r) => r.netWorth <= 0);
  const yearsOfRunway = runsOut ? runsOut.age - inputs.retirementAge : inputs.projectionEndAge - inputs.retirementAge;

  const metrics = [
    { label: "Net Worth at Retirement", value: fmt(retirementRow?.netWorth ?? 0) },
    { label: "Peak Net Worth", value: fmt(peakNW) },
    { label: `Net Worth at Age ${lastRow.age}`, value: fmt(lastRow.netWorth) },
    { label: "Years of Runway", value: runsOut ? `${yearsOfRunway} yrs` : `${yearsOfRunway}+ yrs` },
    { label: "Retirement Age", value: String(inputs.retirementAge) },
    { label: "Monthly Budget (Today)", value: fmt((inputs.budgetPeriods?.[0]?.items?.reduce((s, i) => s + (i.amounts[0] ?? 0), 0) ?? 0)) },
  ];

  let y = 38;
  const cardW = (W - 28 - 10) / 3;
  const cardH = 22;

  metrics.forEach((m, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 14 + col * (cardW + 5);
    const cy = y + row * (cardH + 4);

    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, cy, cardW, cardH, 2, 2, "F");

    doc.setTextColor(SLATE_LIGHT);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(m.label.toUpperCase(), x + 4, cy + 7);

    doc.setTextColor(GREEN);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(m.value, x + 4, cy + 16);
  });

  y += 2 * (cardH + 4) + 8;

  // ── Plan inputs section ──
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, y, W - 28, 52, 2, 2, "F");

  doc.setTextColor(GREEN);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Plan Inputs", 18, y + 8);

  const inputRows: [string, string][] = [
    ["Current Age", String(inputs.currentAge)],
    ["Retirement Age", String(inputs.retirementAge)],
    ["Projection End Age", String(inputs.projectionEndAge)],
    ["Current Income", fmtFull(inputs.currentGrossIncome)],
    ["Investment Growth Rate", fmtPct(inputs.investmentGrowthRate)],
    ["Inflation Rate", fmtPct(inputs.inflationRate)],
    ["Filing Status", inputs.filingStatus.replace(/_/g, " ")],
    ["State", inputs.stateCode],
    ["Current 401(k)", fmtFull(inputs.current401k)],
    ["Current Investments", fmtFull(inputs.currentInvestments)],
    ["Current Roth IRA", fmtFull(inputs.currentRothIRA)],
    ["Home Value", fmtFull(inputs.homeValue)],
  ];

  const colW = (W - 28 - 8) / 3;
  inputRows.forEach(([label, value], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 18 + col * colW;
    const iy = y + 14 + row * 9;

    doc.setTextColor(SLATE_LIGHT);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(label, x, iy);

    doc.setTextColor(SLATE);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(value, x, iy + 5);
  });

  y += 60;

  // ── Net worth trajectory table (every 5 years) ──
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(14, y, W - 28, 8, 2, 2, "F");
  doc.setTextColor(GREEN);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Net Worth Trajectory", 18, y + 5.5);

  y += 10;

  const milestoneRows = projection
    .filter((r) => r.age % 5 === 0 || r.age === inputs.retirementAge || r.age === lastRow.age)
    .filter((r, i, arr) => i === 0 || r.age !== arr[i - 1].age);

  autoTable(doc, {
    startY: y,
    margin: { left: 14, right: 14 },
    head: [["Age", "Year", "Net Worth", "Non-Home NW", "Income", "Expenses", "Status"]],
    body: milestoneRows.map((r) => [
      r.age,
      r.year,
      fmtFull(r.netWorth),
      fmtFull(r.nonHomeNetWorth),
      fmtFull(r.income + r.socialSecurityIncome),
      fmtFull(r.annualExpenses),
      r.retired ? "Retired" : "Working",
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [249, 245, 240] },
    columnStyles: {
      0: { halign: "center", cellWidth: 12 },
      1: { halign: "center", cellWidth: 14 },
      6: { halign: "center", cellWidth: 18 },
    },
  });

  // ── Footer ──
  const footerY = H - 10;
  doc.setFillColor(GREEN);
  doc.rect(0, footerY - 4, W, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Project Retire  •  projectretire.com  •  Projections are estimates. Consult a financial advisor.", W / 2, footerY + 2, { align: "center" });

  doc.save(`${planName.replace(/\s+/g, "_")}_Summary.pdf`);
}

// ─── Data Table PDF (Pro) ──────────────────────────────────────────────────────

export function exportDataTablePDF(
  planName: string,
  inputs: RetirementInputs,
  projection: ProjectionRow[]
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const W = doc.internal.pageSize.getWidth();

  // ── Header ──
  doc.setFillColor(GREEN);
  doc.rect(0, 0, W, 20, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Project Retire — Year-by-Year Projection", 14, 10);

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`${planName}  •  Generated ${today}`, W - 14, 10, { align: "right" });
  doc.text(`Ages ${projection[0].age}–${projection[projection.length - 1].age}  •  ${projection.length} years`, W - 14, 16, { align: "right" });

  autoTable(doc, {
    startY: 24,
    margin: { left: 8, right: 8 },
    head: [[
      "Age", "Year", "Status",
      "Income", "SS Income", "Expenses", "Taxes",
      "Net Worth", "Non-Home NW", "Investments", "401(k)", "Roth IRA",
      "Roth Conv.", "RMD",
    ]],
    body: projection.map((r) => [
      r.age,
      r.year,
      r.retired ? "Retired" : "Working",
      fmtFull(r.income),
      fmtFull(r.socialSecurityIncome),
      fmtFull(r.annualExpenses),
      fmtFull(r.totalTax),
      fmtFull(r.netWorth),
      fmtFull(r.nonHomeNetWorth),
      fmtFull(r.investments),
      fmtFull(r.k401),
      fmtFull(r.rothIRA),
      r.rothConversionAmount > 0 ? fmtFull(r.rothConversionAmount) : "—",
      r.rmdAmount > 0 ? fmtFull(r.rmdAmount) : "—",
    ]),
    styles: { fontSize: 6.5, cellPadding: 1.5 },
    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [249, 245, 240] },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { halign: "center", cellWidth: 12 },
      2: { halign: "center", cellWidth: 16 },
    },
    didDrawPage: (data) => {
      // Footer on each page
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFillColor(GREEN);
      doc.rect(0, pageH - 8, W, 8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(6);
      doc.text(
        `Project Retire  •  ${planName}  •  Page ${data.pageNumber}  •  Projections are estimates only.`,
        W / 2, pageH - 3, { align: "center" }
      );
    },
  });

  doc.save(`${planName.replace(/\s+/g, "_")}_DataTable.pdf`);
}

// ─── CSV Export (Pro) ──────────────────────────────────────────────────────────

export function exportCSV(planName: string, projection: ProjectionRow[]): void {
  const headers = [
    "Age", "Year", "Status",
    "Income", "SS Income", "Alt Income", "Expenses", "Annual Budget",
    "Federal Tax", "State Tax", "Total Tax", "Effective Tax Rate",
    "Net Worth", "Non-Home Net Worth", "Adj Net Worth (Inflation)",
    "Cash", "Investments", "401(k)", "Roth 401(k)", "Roth IRA", "IRA",
    "Home Value", "Home Loan",
    "Roth Conversion", "RMD",
    "Draw Investments", "Draw 401(k)", "Draw Roth IRA",
  ];

  const rows = projection.map((r) => [
    r.age, r.year, r.retired ? "Retired" : "Working",
    r.income, r.socialSecurityIncome, r.additionalPhaseIncome, r.annualExpenses, r.monthlyBudget * 12,
    r.federalTax, r.stateTax, r.totalTax, fmtPct(r.yearEffectiveTaxRate),
    r.netWorth, r.nonHomeNetWorth, r.adjustedNetWorth,
    r.cash, r.investments, r.k401, r.roth401k, r.rothIRA, r.ira,
    r.homeValue, r.homeLoan,
    r.rothConversionAmount, r.rmdAmount,
    r.drawInvestments, r.drawK401, r.drawRothIRA,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${cell}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${planName.replace(/\s+/g, "_")}_Projection.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
