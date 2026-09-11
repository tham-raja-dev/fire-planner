export const LIFE_EXPECTANCY = 90;
export const SIMULATION_COUNT = 1000;
export const SUCCESS_THRESHOLD = 0.85;
export const MODEL_VERSION = "2026-09-mc-v1";

export type Details = {
  age: number; mutualFunds: number; monthlySip: number; stocks: number;
  fixedDeposits: number; realEstate: number; bankSavings: number;
  monthlyIncome: number; monthlyExpense: number;
};
export type Dependents = { count: number; annualCostPerDependent: number; supportYears: number };
export type Loan = { balance: number; emi: number; remainingYears: number };
export type Outlook = "cautious" | "typical" | "optimistic";
export type YearPoint = { age: number; corpus: number; expense: number; requestedExpense: number };
export type Recommendation = { monthlySip: number | null; monthlyIncome: number | null; monthlyExpense: number | null };
export type SimulationResult = {
  retirementAge: number | null; successRate: number;
  paths: Record<Outlook, YearPoint[]>; samples: number[][]; seed: number;
};

export const BASE_RATES = {
  inflation: 0.06, savings: 0.04, mutualFunds: 0.10,
  stocks: 0.10, fixedDeposits: 0.06, realEstate: 0.08,
} as const;

type Shocks = { inflation: number; savings: number; mutualFunds: number; stocks: number; fixedDeposits: number; realEstate: number };
type Buckets = { savings: number; fixedDeposits: number; mutualFunds: number; stocks: number; realEstate: number };

function mulberry32(seed: number) {
  return () => {
    let value = seed += 0x6d2b79f5;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
function normal(random: () => number) {
  const a = Math.max(random(), 1e-9);
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * random());
}
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

function scenarioMatrix(seed: number, count = SIMULATION_COUNT): Shocks[][] {
  const random = mulberry32(seed);
  return Array.from({ length: count }, () =>
    Array.from({ length: LIFE_EXPECTANCY - 19 }, () => {
      const market = normal(random);
      const inflationShock = normal(random);
      return {
        inflation: clamp(BASE_RATES.inflation + inflationShock * 0.018, 0.01, 0.12),
        savings: clamp(BASE_RATES.savings + normal(random) * 0.006, 0, 0.08),
        mutualFunds: clamp(BASE_RATES.mutualFunds + market * 0.12 + normal(random) * 0.08, -0.42, 0.45),
        stocks: clamp(BASE_RATES.stocks + market * 0.15 + normal(random) * 0.11, -0.52, 0.55),
        fixedDeposits: clamp(BASE_RATES.fixedDeposits + normal(random) * 0.009, 0.02, 0.10),
        realEstate: clamp(BASE_RATES.realEstate + market * 0.04 + normal(random) * 0.075, -0.18, 0.30),
      };
    }),
  );
}

const dependentMonthlyCost = (dependents: Dependents) => dependents.count * dependents.annualCostPerDependent / 12;
const total = (b: Buckets) => b.savings + b.fixedDeposits + b.mutualFunds + b.stocks + b.realEstate;
function grow(b: Buckets, rates: Shocks) {
  b.savings *= 1 + rates.savings;
  b.fixedDeposits *= 1 + rates.fixedDeposits;
  b.mutualFunds *= 1 + rates.mutualFunds;
  b.stocks *= 1 + rates.stocks;
  b.realEstate *= 1 + rates.realEstate;
}
export function withdrawFromBuckets(b: Buckets, amount: number) {
  let remaining = amount;
  for (const key of ["savings", "fixedDeposits", "mutualFunds", "stocks", "realEstate"] as const) {
    const used = Math.min(b[key], remaining);
    b[key] -= used;
    remaining -= used;
  }
  return amount - remaining;
}

function runPath(details: Details, dependents: Dependents, loan: Loan, retirementAge: number, shocks: Shocks[]): { points: YearPoint[]; success: boolean } {
  const buckets: Buckets = {
    savings: details.bankSavings, fixedDeposits: details.fixedDeposits,
    mutualFunds: details.mutualFunds, stocks: details.stocks, realEstate: details.realEstate,
  };
  let expenseMultiplier = 1;
  const points: YearPoint[] = [];
  let success = true;
  for (let age = details.age; age <= LIFE_EXPECTANCY; age += 1) {
    const elapsed = age - details.age;
    const rates = shocks[age - 20];
    const dependentCost = elapsed < dependents.supportYears ? dependentMonthlyCost(dependents) * expenseMultiplier : 0;
    const loanCost = elapsed < loan.remainingYears ? loan.emi : 0;
    const requestedExpense = (details.monthlyExpense * expenseMultiplier + dependentCost + loanCost) * 12;
    const displayedCorpus = total(buckets);
    let paidExpense = requestedExpense;
    if (age < retirementAge) {
      grow(buckets, rates);
      const income = details.monthlyIncome * expenseMultiplier;
      const availableAfterCosts = income - details.monthlyExpense * expenseMultiplier - dependentCost - loanCost;
      if (availableAfterCosts < 0) withdrawFromBuckets(buckets, Math.abs(availableAfterCosts) * 12);
      const affordableSip = Math.min(details.monthlySip * expenseMultiplier, Math.max(0, availableAfterCosts));
      buckets.mutualFunds += affordableSip * 12;
      buckets.savings += Math.max(0, availableAfterCosts - affordableSip) * 12;
    } else {
      grow(buckets, rates);
      paidExpense = withdrawFromBuckets(buckets, requestedExpense);
      if (paidExpense + 0.01 < requestedExpense) success = false;
    }
    points.push({ age, corpus: displayedCorpus, expense: paidExpense, requestedExpense });
    expenseMultiplier *= 1 + rates.inflation;
  }
  return { points, success };
}

function successAt(details: Details, dependents: Dependents, loan: Loan, retirementAge: number, matrix: Shocks[][]) {
  let successes = 0;
  for (const shocks of matrix) if (runPath(details, dependents, loan, retirementAge, shocks).success) successes += 1;
  return successes / matrix.length;
}

const percentileIndex: Record<Outlook, number> = { cautious: 0.20, typical: 0.50, optimistic: 0.80 };
function percentilePaths(runs: ReturnType<typeof runPath>[]): Record<Outlook, YearPoint[]> {
  const ages = runs[0].points.map((point) => point.age);
  const build = (outlook: Outlook) => ages.map((age, year) => {
    const ordered = [...runs].sort((a, b) => a.points[year].corpus - b.points[year].corpus);
    return ordered[Math.floor((ordered.length - 1) * percentileIndex[outlook])].points[year];
  });
  return { cautious: build("cautious"), typical: build("typical"), optimistic: build("optimistic") };
}

export function calculatePlan(details: Details, dependents: Dependents, loan: Loan, seed = 731942): SimulationResult {
  const matrix = scenarioMatrix(seed);
  let retirementAge: number | null = null;
  let successRate = 0;
  const candidates = details.monthlyIncome === 0 ? [details.age] : Array.from({ length: LIFE_EXPECTANCY - details.age }, (_, i) => details.age + i);
  for (const age of candidates) {
    const rate = successAt(details, dependents, loan, age, matrix);
    if (rate >= SUCCESS_THRESHOLD) { retirementAge = age; successRate = rate; break; }
  }
  const chartAge = retirementAge ?? details.age;
  const runs = matrix.map((shocks) => runPath(details, dependents, loan, chartAge, shocks));
  if (retirementAge === null) successRate = runs.filter((run) => run.success).length / runs.length;
  return {
    retirementAge, successRate, paths: percentilePaths(runs), seed,
    samples: runs.filter((_, index) => index % 10 === 0).map((run) => run.points.map((point) => point.corpus)),
  };
}

export function recommendationsFor(details: Details, dependents: Dependents, loan: Loan, targetAge: number, seed = 731942): Recommendation {
  const matrix = scenarioMatrix(seed);
  const passes = (candidate: Details) => successAt(candidate, dependents, loan, targetAge, matrix) >= SUCCESS_THRESHOLD;
  const searchMinimum = (key: "monthlySip" | "monthlyIncome", high: number) => {
    if (!passes({ ...details, [key]: high })) return null;
    let low = 0;
    for (let i = 0; i < 22; i += 1) {
      const middle = (low + high) / 2;
      if (passes({ ...details, [key]: middle })) high = middle; else low = middle;
    }
    return Math.ceil(high / 500) * 500;
  };
  let lowExpense = 0;
  let highExpense = details.monthlyExpense;
  for (let i = 0; i < 22; i += 1) {
    const middle = (lowExpense + highExpense) / 2;
    if (passes({ ...details, monthlyExpense: middle })) lowExpense = middle; else highExpense = middle;
  }
  return {
    monthlySip: searchMinimum("monthlySip", Math.max(details.monthlySip, details.monthlyIncome)),
    monthlyIncome: searchMinimum("monthlyIncome", 2_000_000),
    monthlyExpense: passes({ ...details, monthlyExpense: 0 }) ? Math.floor(lowExpense / 500) * 500 : null,
  };
}

export function projectScenario(details: Details, dependents: Dependents, loan: Loan, retirementAge: number, seed = 731942) {
  const matrix = scenarioMatrix(seed);
  const runs = matrix.map((shocks) => runPath(details, dependents, loan, retirementAge, shocks));
  return { successRate: runs.filter((run) => run.success).length / runs.length, paths: percentilePaths(runs) };
}
