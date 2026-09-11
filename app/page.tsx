"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Download, Eye, FileSpreadsheet, FileText, Pencil, Share2, SlidersHorizontal, X,
} from "lucide-react";
import { BASE_RATES, LIFE_EXPECTANCY, calculatePlan, projectScenario } from "@/lib/fire-model";
import type { Outlook, Recommendation, SimulationResult, YearPoint } from "@/lib/fire-model";

type Details = {
  age: number; mutualFunds: number; monthlySip: number; stocks: number; fixedDeposits: number; realEstate: number;
  bankSavings: number; monthlyIncome: number; monthlyExpense: number;
};
type Dependents = { count: number; annualCostPerDependent: number; supportYears: number };
type Loan = { balance: number; emi: number; remainingYears: number };
type Scenario = { monthlyInvestment: number; monthlyIncome: number; monthlyExpense: number; incomeAnchor: number };

const DEFAULTS: Details = {
  age: 34, mutualFunds: 4_000_000, monthlySip: 120_000, stocks: 120_000, fixedDeposits: 120_000, realEstate: 0,
  bankSavings: 100_000,
  monthlyIncome: 120_000, monthlyExpense: 120_000,
};
const DEFAULT_DEPENDENTS: Dependents = { count: 0, annualCostPerDependent: 0, supportYears: 10 };
const DEFAULT_LOAN: Loan = { balance: 0, emi: 0, remainingYears: 5 };
const MUTUAL_FUND_RETURN = 0.10;
const FIXED_DEPOSIT_RETURN = 0.06;
const REAL_ESTATE_RETURN = 0.08;
const NEW_SAVINGS_RETURN = 0.04;
const POST_RETIREMENT_RETURN = 0.07;
const INFLATION = 0.06;

const inr = (value: number, compact = true) => {
  if (compact && value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(1)} cr`;
  if (compact && value >= 100_000) return `₹${(value / 100_000).toFixed(1)} L`;
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
};
const chartMetric = (value: number) => {
  if (value >= 10_000_000) return `${(value / 10_000_000).toFixed(2)}cr`;
  if (value >= 100_000) return `${(value / 100_000).toFixed(2)}L`;
  return Math.round(value).toLocaleString("en-IN");
};
const dependentMonthlyCost = (dependents: Dependents) => dependents.count * dependents.annualCostPerDependent / 12;
const investedTotal = (details: Details) => details.mutualFunds + details.fixedDeposits + details.realEstate + details.bankSavings;
const baselineInvestment = (details: Details, dependents: Dependents, loan: Loan) =>
  Math.max(0, details.monthlyIncome - details.monthlyExpense - dependentMonthlyCost(dependents) - loan.emi);

function monthlyInvestmentAt(details: Details, dependents: Dependents, loan: Loan, monthlyInvestment: number, elapsed: number) {
  const releasedLoanEmi = elapsed >= loan.remainingYears ? loan.emi : 0;
  const releasedDependentCost = elapsed >= dependents.supportYears ? dependentMonthlyCost(dependents) : 0;
  return (monthlyInvestment + releasedLoanEmi + releasedDependentCost) * Math.pow(1 + INFLATION, elapsed);
}

function annualRetirementCost(details: Details, dependents: Dependents, loan: Loan, monthlyExpense: number, elapsed: number) {
  const livingCosts = monthlyExpense * Math.pow(1 + INFLATION, elapsed);
  const dependentCosts = elapsed < dependents.supportYears ? dependentMonthlyCost(dependents) * Math.pow(1 + INFLATION, elapsed) : 0;
  const loanCosts = elapsed < loan.remainingYears ? loan.emi : 0;
  return (livingCosts + dependentCosts + loanCosts) * 12;
}

export function corpusAtRetirement(details: Details, dependents: Dependents, loan: Loan, retirementAge: number, monthlyInvestment: number) {
  let mutualFunds = details.mutualFunds;
  let fixedDeposits = details.fixedDeposits;
  let realEstate = details.realEstate;
  let newSavings = details.bankSavings;
  for (let age = details.age; age < retirementAge; age += 1) {
    const elapsed = age - details.age;
    mutualFunds *= 1 + MUTUAL_FUND_RETURN;
    fixedDeposits *= 1 + FIXED_DEPOSIT_RETURN;
    realEstate *= 1 + REAL_ESTATE_RETURN;
    newSavings = newSavings * (1 + NEW_SAVINGS_RETURN) + monthlyInvestmentAt(details, dependents, loan, monthlyInvestment, elapsed) * 12;
  }
  return mutualFunds + fixedDeposits + realEstate + newSavings;
}

export function corpusLastsToLifeExpectancy(details: Details, dependents: Dependents, loan: Loan, retirementAge: number, monthlyInvestment: number, monthlyExpense: number) {
  let corpus = corpusAtRetirement(details, dependents, loan, retirementAge, monthlyInvestment);
  for (let age = retirementAge; age <= LIFE_EXPECTANCY; age += 1) {
    const elapsed = age - details.age;
    corpus = corpus * (1 + POST_RETIREMENT_RETURN) - annualRetirementCost(details, dependents, loan, monthlyExpense, elapsed);
    if (corpus < 0) return false;
  }
  return true;
}

export function retirementAgeFor(details: Details, dependents: Dependents, loan: Loan, investmentOverride?: number, expenseOverride?: number) {
  const monthlyInvestment = investmentOverride ?? baselineInvestment(details, dependents, loan);
  const monthlyExpense = expenseOverride ?? details.monthlyExpense;
  if (details.monthlyIncome === 0) {
    return corpusLastsToLifeExpectancy(details, dependents, loan, details.age, monthlyInvestment, monthlyExpense) ? details.age : null;
  }
  for (let age = details.age; age < LIFE_EXPECTANCY; age += 1) {
    if (corpusLastsToLifeExpectancy(details, dependents, loan, age, monthlyInvestment, monthlyExpense)) return age;
  }
  return null;
}

function RangeField({ label, value, onChange, min, max, step = 1000, prefix = "₹", onInteract }: {
  label: string; value: number; onChange: (value: number) => void;
  min: number; max: number; step?: number; prefix?: string; onInteract?: () => void;
}) {
  const labelId = useId();
  const [editing, setEditing] = useState(false);
  const [hasEdited, setHasEdited] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const numberInputRef = useRef<HTMLInputElement>(null);
  const pendingCaretRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (pendingCaretRef.current === null) return;
    numberInputRef.current?.setSelectionRange(pendingCaretRef.current, pendingCaretRef.current);
    pendingCaretRef.current = null;
  }, [draft, hasEdited]);
  const progress = ((value - min) / (max - min)) * 100;
  return (
    <div className="range-field" onPointerDown={onInteract}>
      <span id={labelId}>{label}</span>
      <div className="number-wrap">
        {prefix && <span>{prefix}</span>}
        <input
          ref={numberInputRef}
          className="number-value"
          inputMode="numeric"
          value={editing && hasEdited ? draft : value.toLocaleString("en-IN")}
          aria-label={`${label} value`}
          onFocus={() => { setEditing(true); setHasEdited(false); setDraft(String(value)); onInteract?.(); }}
          onBlur={() => { setEditing(false); setHasEdited(false); }}
          onChange={(event) => {
            const caret = event.target.selectionStart ?? event.target.value.length;
            const digitCaret = event.target.value.slice(0, caret).replace(/\D/g, "").length;
            const raw = event.target.value.replace(/\D/g, "");
            pendingCaretRef.current = digitCaret;
            setHasEdited(true);
            setDraft(raw);
            if (raw === "") return;
            onChange(Math.min(max, Math.max(min, Number(raw))));
          }}
        />
      </div>
      <input
        className="value-slider"
        style={{ "--range-progress": `${progress}%` } as React.CSSProperties}
        type="range" min={min} max={max} step={step} value={value}
        onFocus={onInteract}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-labelledby={labelId}
      />
    </div>
  );
}

const INTRO_CASH_BARS = [94,94,105,105,114,114,128,157,173,173,188,188,199,199,211,211,225,225,241,241,251,251,263,263,268,268,274,274,274,274,274,274,263,263,248,248,241,241,231,231,225,225,217,217,211,211,199,199,188,188];
const INTRO_EXPENSE_BARS = [55,55,62,62,67,67,75,75,84,84,90,90,95,95,102,102,109,109,115,115,120,120,127,127,129,129,132,132,132,132,132,132,127,127,119,119,115,115,112,112,109,109,105,105,102,102,95,95,90,90];
function IntroChart() {
  return <div className="intro-chart" aria-label="Animated example of growing investments and changing expenses">
    <div className="intro-bars intro-cash" aria-hidden="true">
      {INTRO_CASH_BARS.map((height, index) => <i key={index} style={{ height, "--intro-delay": `${index * -85}ms` } as React.CSSProperties} />)}
    </div>
    <div className="intro-bars intro-expenses" aria-hidden="true">
      {INTRO_EXPENSE_BARS.map((height, index) => <i key={index} style={{ height, "--intro-delay": `${index * -85}ms` } as React.CSSProperties} />)}
    </div>
  </div>;
}

function ProjectionChart({ details, dependents, loan, retirementAge, scenario, selectedAge, onSelect, compact = false, teaser = false, showStatus = true, projectionData, possiblePaths, showOutcomes = false }: {
  details: Details; dependents: Dependents; loan: Loan; retirementAge: number | null; scenario?: Scenario;
  selectedAge: number | null; onSelect: (age: number | null) => void; compact?: boolean; teaser?: boolean; showStatus?: boolean;
  projectionData?: YearPoint[]; possiblePaths?: number[][]; showOutcomes?: boolean;
}) {
  const fallbackData = useMemo(() => {
    const contribution = scenario
      ? Math.max(0, scenario.monthlyInvestment + scenario.monthlyIncome - scenario.incomeAnchor)
      : baselineInvestment(details, dependents, loan);
    const monthlyExpense = scenario?.monthlyExpense ?? details.monthlyExpense;
    let mutualFunds = details.mutualFunds;
    let fixedDeposits = details.fixedDeposits;
    let realEstate = details.realEstate;
    let newSavings = details.bankSavings;
    let corpus = investedTotal(details);
    const withdrawalAge = retirementAge ?? (scenario ? Math.min(details.age + 10, LIFE_EXPECTANCY - 1) : details.age);
    return Array.from({ length: LIFE_EXPECTANCY + 1 - details.age }, (_, index) => details.age + index).map((age) => {
      const elapsed = age - details.age;
      const requestedExpense = annualRetirementCost(details, dependents, loan, monthlyExpense, elapsed);
      const displayedCorpus = corpus;
      if (age < withdrawalAge) {
        mutualFunds *= 1 + MUTUAL_FUND_RETURN;
        fixedDeposits *= 1 + FIXED_DEPOSIT_RETURN;
        realEstate *= 1 + REAL_ESTATE_RETURN;
        newSavings = newSavings * (1 + NEW_SAVINGS_RETURN) + monthlyInvestmentAt(details, dependents, loan, contribution, elapsed) * 12;
        corpus = mutualFunds + fixedDeposits + realEstate + newSavings;
        return { age, corpus: displayedCorpus, expense: requestedExpense, requestedExpense };
      } else {
        const availableCash = corpus * (1 + POST_RETIREMENT_RETURN);
        const drawableExpense = Math.min(requestedExpense, availableCash);
        corpus = Math.max(0, availableCash - drawableExpense);
        return { age, corpus: displayedCorpus, expense: drawableExpense, requestedExpense };
      }
    });
  }, [details, dependents, loan, retirementAge, scenario]);
  const data = projectionData?.length ? projectionData : fallbackData;
  const maxCorpus = Math.max(...data.map((item) => item.corpus), 1);
  const maxExpense = Math.max(...data.map((item) => item.expense), 1);
  const plotHeight = compact ? 40 : teaser ? 512 : 358;
  const pixelsPerRupee = plotHeight / (maxCorpus + maxExpense);
  const corpusAreaHeight = maxCorpus * pixelsPerRupee;
  const expenseAreaHeight = maxExpense * pixelsPerRupee;
  // Use one rupee-to-pixel scale on both sides of the zero line. Otherwise,
  // similar cash and expense values can look unrelated when each side is
  // independently normalized.
  const tooltipAge = selectedAge ?? (!compact && showStatus ? retirementAge : null);
  const selected = tooltipAge === null ? null : data.find((item) => item.age === tooltipAge) ?? null;
  const firstDepletedAge = data.find((item) => item.corpus <= 0)?.age;
  const outcomeRanges = useMemo(() => {
    if (!showOutcomes || !possiblePaths?.length) return null;
    return data.map((_, yearIndex) => {
      const values = possiblePaths.map((path) => Math.max(0, path[yearIndex] ?? 0)).sort((a, b) => a - b);
      const at = (percentile: number) => values[Math.min(values.length - 1, Math.floor((values.length - 1) * percentile))] ?? 0;
      return { cautious: at(.2), typical: at(.5), optimistic: at(.8) };
    });
  }, [data, possiblePaths, showOutcomes]);

  return (
    <div className={`projection-chart ${compact ? "compact" : ""} ${teaser ? "teaser" : ""} ${selected ? "has-selection" : ""} ${showOutcomes ? "outcome-mode" : ""}`}>
      {selected && !teaser && (
        <div className="chart-tooltip" role="status">
          <strong>{selected.age}y</strong>
          <span>Cash at hand: <b>{selected.corpus > 0 ? chartMetric(selected.corpus) : "0"}</b></span>
          <span>Expenses: <b>{selected.requestedExpense > selected.expense ? "more than cash" : chartMetric(selected.requestedExpense)}</b></span>
        </div>
      )}
      {!teaser && showStatus && retirementAge === null && <div className="chart-warning"><span>⚠</span> Can’t retire with current information</div>}
      <div className="bars-area corpus-area" style={{ height: `${corpusAreaHeight}px` }}>
        {data.map((item, yearIndex) => (
          <button
            key={`corpus-${item.age}`}
            className={`bar-slot ${item.age === selectedAge ? "selected" : ""} ${item.corpus <= 0 ? "depleted" : ""}`}
            onClick={(event) => { event.stopPropagation(); if (!teaser) onSelect(selectedAge === item.age ? null : item.age); }}
            tabIndex={teaser ? -1 : 0}
            aria-label={`Age ${item.age}: corpus ${inr(item.corpus)}`}
          >
            {item.age === firstDepletedAge && <span className="zero-line" />}
            {outcomeRanges && <span className="outcome-range" aria-hidden="true">
              <i className="optimistic" style={{ height: `${Math.min(corpusAreaHeight, outcomeRanges[yearIndex].optimistic * pixelsPerRupee)}px` }} />
              <i className="typical" style={{ height: `${Math.min(corpusAreaHeight, outcomeRanges[yearIndex].typical * pixelsPerRupee)}px` }} />
              <i className="cautious" style={{ height: `${Math.min(corpusAreaHeight, outcomeRanges[yearIndex].cautious * pixelsPerRupee)}px` }} />
            </span>}
            <span className={`bar corpus ${showOutcomes ? "active-outlook" : ""}`} style={{ height: `${item.corpus <= 0 ? 0 : Math.max(2, item.corpus * pixelsPerRupee)}px`, "--bar-delay": `${(item.age - details.age) * -90}ms` } as React.CSSProperties} />
          </button>
        ))}
      </div>
      <div className="bars-area expense-area" style={{ height: `${expenseAreaHeight}px` }}>
        {data.map((item) => (
          <button
            key={`expense-${item.age}`}
            className={`bar-slot ${item.age === selectedAge ? "selected" : ""} ${item.corpus <= 0 ? "depleted" : ""}`}
            onClick={(event) => { event.stopPropagation(); if (!teaser) onSelect(selectedAge === item.age ? null : item.age); }}
            tabIndex={teaser ? -1 : 0}
            aria-label={`Age ${item.age}: spending ${inr(item.expense)}`}
          >
            <span className={`bar expense ${retirementAge !== null && item.age >= retirementAge ? "after-retirement" : ""}`} style={{ height: `${item.expense <= 0 ? 0 : Math.max(2, item.expense * pixelsPerRupee)}px`, "--bar-delay": `${(item.age - details.age) * -90}ms` } as React.CSSProperties} />
          </button>
        ))}
      </div>
    </div>
  );
}

function PlannerTabs({ active, onChange }: { active: "estimate" | "details"; onChange: (tab: "estimate" | "details") => void }) {
  return <nav className="planner-tabs" aria-label="Planner sections">
    <button className={active === "estimate" ? "active" : ""} onClick={() => onChange("estimate")}>Retirement estimate</button>
    <button className={active === "details" ? "active" : ""} onClick={() => onChange("details")}>Your details</button>
  </nav>;
}

function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="sheet-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="bottom-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-handle" />
        <div className="sheet-title"><h2>{title}</h2><button onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        {children}
      </section>
    </div>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<"start" | "details" | "result" | "outcomes">("start");
  const [details, setDetails] = useState<Details>(DEFAULTS);
  const [dependents, setDependents] = useState<Dependents>(DEFAULT_DEPENDENTS);
  const [loan, setLoan] = useState<Loan>(DEFAULT_LOAN);
  const [chartExpanded, setChartExpanded] = useState(false);
  const [selectedAge, setSelectedAge] = useState<number | null>(null);
  const [targetAge, setTargetAge] = useState<number | null>(null);
  const [sheet, setSheet] = useState<"dependents" | "loan" | "share" | "help" | "retirement" | null>(null);
  const [activeDetailSection, setActiveDetailSection] = useState<"age" | "investments" | "income" | "expenditure" | null>(null);
  const [detailsScrolled, setDetailsScrolled] = useState(false);
  const [previewPlan, setPreviewPlan] = useState<SimulationResult | null>(null);
  const [calculatedPlan, setCalculatedPlan] = useState<SimulationResult | null>(null);
  const [outlook, setOutlook] = useState<Outlook>("typical");
  const [editingDetails, setEditingDetails] = useState(false);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastScrollTop = useRef(0);
  const sectionNavigationRef = useRef(false);
  const sectionNavigationTimerRef = useRef<number | null>(null);
  const ageSectionRef = useRef<HTMLElement>(null);
  const investmentsSectionRef = useRef<HTMLElement>(null);
  const incomeSectionRef = useRef<HTMLElement>(null);
  const expenditureSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const worker = new Worker(new URL("./fire.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<{ kind: "plan"; plan: SimulationResult } | { kind: "recommend"; recommendation: Recommendation }>) => {
      if (event.data.kind === "plan") setPreviewPlan(event.data.plan);
      else {
        const rec = event.data.recommendation;
        setRecommendation(rec);
        setRecommendationsLoading(false);
      }
    };
    return () => worker.terminate();
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => workerRef.current?.postMessage({ kind: "plan", details, dependents, loan }), 80);
    return () => window.clearTimeout(timer);
  }, [details, dependents, loan]);
  useEffect(() => {
    if (sheet !== "retirement" || targetAge === null) return;
    const timer = window.setTimeout(() => workerRef.current?.postMessage({ kind: "recommend", details, dependents, loan, targetAge }), 80);
    return () => window.clearTimeout(timer);
  }, [sheet, targetAge, details, dependents, loan]);

  const estimatedAge = calculatedPlan?.retirementAge ?? null;
  const recoveryMode = calculatedPlan !== null && estimatedAge === null && targetAge === null;
  const activeRetirementAge = targetAge ?? estimatedAge ?? details.age;
  const cannotRetire = recoveryMode;
  const alreadyRetired = details.monthlyIncome === 0;
  const showingCurrentRetirement = alreadyRetired && targetAge === null;
  const collapseChart = () => {
    if (chartExpanded) setChartExpanded(false);
    setSelectedAge(null);
  };
  const detailSections = [
    ["age", ageSectionRef], ["investments", investmentsSectionRef],
    ["income", incomeSectionRef], ["expenditure", expenditureSectionRef],
  ] as const;
  const scrollToDetailSection = (section: Exclude<typeof activeDetailSection, null>) => {
    const container = scrollRef.current;
    const target = detailSections.find(([name]) => name === section)?.[1].current;
    if (!target) return;
    sectionNavigationRef.current = true;
    setChartExpanded(false);
    setActiveDetailSection(section);
    if (container) {
      const top = target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 112;
      container.scrollTo({ top, behavior: "smooth" });
    } else {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (sectionNavigationTimerRef.current) window.clearTimeout(sectionNavigationTimerRef.current);
    sectionNavigationTimerRef.current = window.setTimeout(() => { sectionNavigationRef.current = false; }, 120);
  };
  const exportCsv = () => {
    const hypotheticalDetails = details;
    const projection = targetAge === null
      ? calculatedPlan
      : { ...projectScenario(hypotheticalDetails, dependents, loan, targetAge), retirementAge: targetAge, seed: calculatedPlan?.seed ?? 731942 };
    const rows: (string | number)[][] = [
      ["section", "metric", "value"],
      ["summary", "current_age", details.age], ["summary", "retirement_age", targetAge ?? estimatedAge ?? "undetermined"],
      ["summary", "success_probability", projection?.successRate ?? 0], ["summary", "simulation_count", 1000],
      ["summary", "projection_outlook", outlook], ["summary", "simulation_seed", projection?.seed ?? 731942],
      ["input", "mutual_funds", hypotheticalDetails.mutualFunds], ["input", "monthly_mutual_fund_sip", hypotheticalDetails.monthlySip],
      ["input", "stocks", hypotheticalDetails.stocks], ["input", "fixed_deposits", hypotheticalDetails.fixedDeposits],
      ["input", "real_estate", hypotheticalDetails.realEstate], ["input", "bank_savings", hypotheticalDetails.bankSavings],
      ["input", "monthly_income", hypotheticalDetails.monthlyIncome], ["input", "monthly_expenditure", hypotheticalDetails.monthlyExpense],
      ["input", "dependents", dependents.count], ["input", "annual_cost_per_dependent", dependents.annualCostPerDependent],
      ["input", "dependent_support_years", dependents.supportYears], ["input", "loan_balance", loan.balance],
      ["input", "loan_emi", loan.emi], ["input", "loan_years_remaining", loan.remainingYears],
      ["alternative", "required_monthly_sip", recommendation?.monthlySip ?? "not_possible_alone"],
      ["alternative", "required_monthly_income", recommendation?.monthlyIncome ?? "not_possible_alone"],
      ["alternative", "maximum_monthly_expenditure", recommendation?.monthlyExpense ?? "not_possible_alone"],
      ...Object.entries(BASE_RATES).map(([key, value]) => ["rate", key, value] as (string | number)[]),
      ["projection", "age", "cash_at_hand", "requested_expenses", "funded_expenses"],
      ...((projection?.paths[outlook] ?? []).map((point) => ["projection", point.age, Math.round(point.corpus), Math.round(point.requestedExpense), Math.round(point.expense)])),
    ];
    const blob = new Blob([rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = "my-fire-plan.csv"; link.click();
    URL.revokeObjectURL(link.href);
  };
  const nativeShare = async () => {
    const shareData = { title: "My FIRE plan", text: `My target retirement age is ${activeRetirementAge}.`, url: window.location.href };
    if (navigator.share) await navigator.share(shareData);
    else await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
  };

  return (
    <main className="site-shell">
      <section className="mobile-app" aria-label="FIRE retirement planner">
        {screen === "start" && (
          <div className="start-screen">
            <div className="hero-chart">
              <IntroChart />
            </div>
            <section className="start-copy">
              <h1>When could work become<br />optional?</h1>
              <p>See how your investments grow, how your expenses change, and what you can do to retire earlier</p>
              <button className="primary-button" onClick={() => setScreen("details")}>Find my retirement age</button>
              <button className="text-link" onClick={() => setSheet("help")}>What’s this?</button>
            </section>
          </div>
        )}

        {screen === "details" && (
          <div className="details-screen" ref={scrollRef} onScroll={(event) => {
            const nextTop = event.currentTarget.scrollTop;
            if (sectionNavigationRef.current) {
              if (sectionNavigationTimerRef.current) window.clearTimeout(sectionNavigationTimerRef.current);
              sectionNavigationTimerRef.current = window.setTimeout(() => { sectionNavigationRef.current = false; }, 120);
            }
            setDetailsScrolled(nextTop > 4);
            if (nextTop > lastScrollTop.current + 3) {
              setChartExpanded(false);
              setSelectedAge(null);
            } else if (nextTop < lastScrollTop.current - 3 && nextTop <= 12 && !sectionNavigationRef.current) {
              // Expanding the sticky chart while deep in the form changes its
              // height by 262px and makes the content jump beneath it. Restore
              // the expanded state only once the user has returned to the top.
              setChartExpanded(true);
            }
            lastScrollTop.current = nextTop;
            const activationLine = event.currentTarget.getBoundingClientRect().top + (chartExpanded ? 520 : 230);
            const visibleSection = [...detailSections].reverse().find(([, ref]) => ref.current && ref.current.getBoundingClientRect().top <= activationLine);
            if (visibleSection) setActiveDetailSection(visibleSection[0]);
          }}>
            <div
              className={`input-chart ${chartExpanded ? "expanded" : "collapsed"}`}
              onClick={() => setChartExpanded((open) => { if (open) setSelectedAge(null); return !open; })}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") setChartExpanded((open) => { if (open) setSelectedAge(null); return !open; });
              }}
              role="button"
              tabIndex={0}
              aria-label={chartExpanded ? "Collapse projection chart" : "Expand projection chart"}
              aria-expanded={chartExpanded}
            >
              <ProjectionChart details={details} dependents={dependents} loan={loan} retirementAge={null} selectedAge={null} onSelect={() => undefined} compact={!chartExpanded} showStatus={false} projectionData={previewPlan?.paths.typical} />
            </div>
            {chartExpanded && <PlannerTabs active="details" onChange={(tab) => { if (tab === "estimate") setScreen("result"); }} />}
            <div className="input-content">
              <h1>{editingDetails ? "Edit your details" : "Enter your details"}</h1>
              <nav className={`detail-jump-nav ${detailsScrolled ? "scrolled" : ""}`} style={{ top: chartExpanded ? 375 : 89 }} aria-label="Detail sections">
                {(["age", "investments", "income", "expenditure"] as const).map((section) => <button key={section} className={activeDetailSection === section ? "active" : ""} onClick={() => scrollToDetailSection(section)}>{section}</button>)}
              </nav>
              <section className="detail-group age-group" ref={ageSectionRef}>
                <RangeField label="Current age" value={details.age} min={20} max={60} step={1} prefix="" onInteract={collapseChart} onChange={(value) => setDetails({ ...details, age: value })} />
              </section>
              <section className="detail-group" ref={investmentsSectionRef}>
                <h2><span>Investments</span></h2>
                <RangeField label="Mutual Funds" value={details.mutualFunds} min={0} max={20_000_000} step={50_000} prefix="" onInteract={collapseChart} onChange={(value) => setDetails({ ...details, mutualFunds: value })} />
                <RangeField label="Monthly SIPs in Mutual Funds" value={details.monthlySip} min={0} max={500_000} step={5_000} prefix="" onInteract={collapseChart} onChange={(value) => setDetails({ ...details, monthlySip: value })} />
                <RangeField label="Stocks" value={details.stocks} min={0} max={20_000_000} step={50_000} prefix="" onInteract={collapseChart} onChange={(value) => setDetails({ ...details, stocks: value })} />
                <RangeField label="FD" value={details.fixedDeposits} min={0} max={10_000_000} step={50_000} prefix="" onInteract={collapseChart} onChange={(value) => setDetails({ ...details, fixedDeposits: value })} />
                <RangeField label="Real Estate" value={details.realEstate} min={0} max={50_000_000} step={100_000} prefix="" onInteract={collapseChart} onChange={(value) => setDetails({ ...details, realEstate: value })} />
              </section>
              <section className="detail-group" ref={incomeSectionRef}>
                <h2><span>Income</span></h2>
                <RangeField label="Monthly income" value={details.monthlyIncome} min={0} max={500_000} step={5_000} prefix="" onInteract={collapseChart} onChange={(value) => setDetails({ ...details, monthlyIncome: value })} />
                <RangeField label="Bank savings" value={details.bankSavings} min={0} max={10_000_000} step={50_000} prefix="" onInteract={collapseChart} onChange={(value) => setDetails({ ...details, bankSavings: value })} />
              </section>
              <section className="detail-group" ref={expenditureSectionRef}>
                <h2><span>Expenditure</span></h2>
                <RangeField label="Monthly expenditure" value={details.monthlyExpense} min={10_000} max={300_000} step={5_000} prefix="" onInteract={collapseChart} onChange={(value) => setDetails({ ...details, monthlyExpense: value })} />
              </section>
              <div className={`add-links ${dependents.count || loan.balance || loan.emi ? "has-summaries" : ""}`}>
                {dependents.count ? <button className="detail-summary-card" onClick={() => setSheet("dependents")}><span>Dependencies</span><b>{dependents.count} × {dependents.annualCostPerDependent.toLocaleString("en-IN")}</b><Pencil size={20} /></button> : <button onClick={() => setSheet("dependents")}>Add dependencies</button>}
                {loan.balance || loan.emi ? <button className="detail-summary-card" onClick={() => setSheet("loan")}><span>Loans</span><b>{loan.balance.toLocaleString("en-IN")}</b><Pencil size={20} /></button> : <button onClick={() => setSheet("loan")}>Add Loans</button>}
              </div>
            </div>
            <div className="sticky-footer"><button className="primary-button" onClick={() => {
              const result = calculatePlan(details, dependents, loan);
              setCalculatedPlan(result);
              setScreen("result");
              setSelectedAge(result.retirementAge); setTargetAge(null); setEditingDetails(false);
            }}>{editingDetails ? "Update my retirement age" : "Find my retirement age"}</button></div>
          </div>
        )}

        {screen === "result" && (
          <div className="result-screen">
            <ProjectionChart details={details} dependents={dependents} loan={loan} retirementAge={estimatedAge} selectedAge={selectedAge} onSelect={setSelectedAge}
              projectionData={calculatedPlan?.paths[outlook]} />
            <section className="result-content">
              {!cannotRetire ? <button className="result-summary-card" onClick={() => {
                setRecommendationsLoading(true); setTargetAge(details.age);
                setSheet("retirement");
              }}>
                <span><b>{showingCurrentRetirement ? "You are already retired" : "Your retirement age"}</b><small><SlidersHorizontal size={18} />Change</small></span>
                <strong>{activeRetirementAge}</strong>
              </button> : <button className="unable-card" onClick={() => {
                const age = Math.min(Math.max(details.age, 35), 70);
                setRecommendationsLoading(true); setTargetAge(age);
                setSheet("retirement");
              }}>
                <b>Unable to determine retirement age</b>
                <span>You can still set an age you want to retire and determine what needs to change</span>
                <small><SlidersHorizontal size={18} />Set retirement age</small>
              </button>}
              <section className="outlook-section">
                <h2>Projection outlook</h2>
                {calculatedPlan && <div className="success-copy"><b>{Math.round(calculatedPlan.successRate * 100)} out of 100</b><span>possible futures last through age 90</span></div>}
                <div className="outlook-options">
                  {(["cautious", "typical", "optimistic"] as const).map((value) => <button key={value} className={outlook === value ? "active" : ""} onClick={() => setOutlook(value)}>{value}</button>)}
                </div>
                <p>{outlook === "cautious" ? "A weaker outcome from the same possible futures" : outlook === "optimistic" ? "A stronger outcome from the same possible futures" : "The middle outcome across possible futures"}</p>
                <button className="outcomes-link" onClick={() => setScreen("outcomes")}><Eye size={19} />See possible outcomes</button>
              </section>
            </section>
            <nav className="bottom-nav" aria-label="Plan actions">
              <button className="share-main" onClick={() => { setEditingDetails(true); setChartExpanded(false); setScreen("details"); }}><Pencil size={20} />Edit details</button>
              <button className="export-main primary-button" onClick={exportCsv}>Export</button>
            </nav>
          </div>
        )}

        {screen === "outcomes" && (
          <div className="outcomes-screen">
            <header><button onClick={() => setScreen("result")} aria-label="Back to plan">‹</button><div><h1>Possible outcomes</h1><p>Explore how the same plan may unfold</p></div></header>
            <ProjectionChart details={details} dependents={dependents} loan={loan} retirementAge={estimatedAge} selectedAge={selectedAge} onSelect={setSelectedAge}
              projectionData={calculatedPlan?.paths[outlook]} possiblePaths={calculatedPlan?.samples} showOutcomes />
            <section className="outcomes-content">
              <p>The overlapping projections show cautious, typical and optimistic outcomes from the same 1,000 possible futures.</p>
              <h2>View this projection as</h2>
              <div className="outlook-options">
                {(["cautious", "typical", "optimistic"] as const).map((value) => <button key={value} className={outlook === value ? "active" : ""} onClick={() => setOutlook(value)}>{value}</button>)}
              </div>
              <p className="outlook-description">{outlook === "cautious" ? "A weaker outcome from the same possible futures" : outlook === "optimistic" ? "A stronger outcome from the same possible futures" : "The middle outcome across possible futures"}</p>
              <div className="outcome-note"><b>How your age is calculated</b><p>We test 1,000 possible futures. Your retirement age must last until 90 in at least 85 out of 100 of them.</p></div>
            </section>
            <div className="sticky-footer"><button className="primary-button" onClick={() => setScreen("result")}>Back to my plan</button></div>
          </div>
        )}

        {sheet === "retirement" && targetAge !== null && <BottomSheet title={estimatedAge === null ? "Set retirement age" : "Change retirement age"} onClose={() => { setSheet(null); setTargetAge(null); }}>
          {estimatedAge !== null && <p className="calculated-age-copy">Retirement age calculated: {estimatedAge}</p>}
          <RangeField label="What if I retire by…" value={targetAge} min={details.age} max={LIFE_EXPECTANCY - 1} step={1} prefix="" onChange={(age) => {
            setRecommendationsLoading(true); setTargetAge(age);
          }} />
          <h3 className="changes-heading">You need to bring in one of these changes</h3>
          <div className={`change-alternatives ${recommendationsLoading ? "loading" : ""}`}>
            {[
              ["Monthly SIPs", recommendation?.monthlySip, details.monthlySip],
              ["Salary", recommendation?.monthlyIncome, details.monthlyIncome],
              ["Expenditure", recommendation?.monthlyExpense, details.monthlyExpense],
            ].map(([label, value, current], index) => {
              if (value === null || value === undefined) return <div className="change-row unavailable" key={String(label)}>
                {index > 0 && <i>or</i>}<span><small>{label}</small><b>Not enough on its own</b></span>
              </div>;
              const difference = Number(value) - Number(current);
              const percent = Number(current) > 0 ? Math.round(Math.abs(difference) / Number(current) * 100) : 100;
              return <div className="change-row" key={String(label)}>
                {index > 0 && <i>or</i>}
                <span><small>{label}</small><b>{inr(Number(value), false)}</b></span>
                <em className={difference <= 0 && label === "Expenditure" ? "expense-change" : ""}>{difference >= 0 ? "+" : "−"}{percent}%</em>
              </div>;
            })}
          </div>
          <button className="secondary-action sheet-action" onClick={exportCsv}><Download size={20} />Download plan</button>
        </BottomSheet>}

        {sheet === "dependents" && <BottomSheet title="Add dependents" onClose={() => setSheet(null)}>
          <RangeField label="Number of dependents" value={dependents.count} min={0} max={8} step={1} prefix="" onChange={(value) => setDependents({ ...dependents, count: value })} />
          <RangeField label="Annual cost per dependent" value={dependents.annualCostPerDependent} min={0} max={2_400_000} step={25_000} onChange={(value) => setDependents({ ...dependents, annualCostPerDependent: value })} />
          <RangeField label="Support for years" value={dependents.supportYears} min={1} max={30} step={1} prefix="" onChange={(value) => setDependents({ ...dependents, supportYears: value })} />
          <button className="primary-button sheet-action" onClick={() => setSheet(null)}>Save dependents</button>
        </BottomSheet>}

        {sheet === "loan" && <BottomSheet title="Add a loan" onClose={() => setSheet(null)}>
          <RangeField label="Outstanding balance" value={loan.balance} min={0} max={20_000_000} step={50_000} onChange={(value) => setLoan({ ...loan, balance: value })} />
          <RangeField label="Monthly EMI" value={loan.emi} min={0} max={300_000} step={2_500} onChange={(value) => setLoan({ ...loan, emi: value })} />
          <RangeField label="Years remaining" value={loan.remainingYears} min={1} max={30} step={1} prefix="" onChange={(value) => setLoan({ ...loan, remainingYears: value })} />
          <button className="primary-button sheet-action" onClick={() => setSheet(null)}>Save loan</button>
        </BottomSheet>}

        {sheet === "share" && <BottomSheet title="Save or share your plan" onClose={() => setSheet(null)}>
          <button className="sheet-option" onClick={exportCsv}><FileSpreadsheet size={21} /><span><b>Download spreadsheet</b><small>Editable plan and assumptions</small></span><Download size={18} /></button>
          <button className="sheet-option" onClick={() => window.print()}><FileText size={21} /><span><b>Save as PDF</b><small>Summary, chart and target plan</small></span><Download size={18} /></button>
          <button className="sheet-option" onClick={nativeShare}><Share2 size={21} /><span><b>Share from your phone</b><small>Use your device’s share menu</small></span></button>
        </BottomSheet>}

        {sheet === "help" && <BottomSheet title="What does this show?" onClose={() => setSheet(null)}>
          <div className="help-copy"><p>Green bars show your projected investible corpus. Red bars show what you may spend each year.</p><p>Enter your current finances to estimate when your investments could support your lifestyle without a salary.</p><p>This is an educational planning tool, not financial advice.</p></div>
          <button className="primary-button sheet-action" onClick={() => setSheet(null)}>Got it</button>
        </BottomSheet>}
      </section>
    </main>
  );
}
