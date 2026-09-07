import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, hmr: false },
});

const calculations = await vite.ssrLoadModule("/app/page.tsx");
const noDependents = { count: 0, annualCostPerDependent: 0, supportYears: 10 };
const noLoan = { balance: 0, emi: 0, remainingYears: 5 };

after(async () => vite.close());

test("applies each existing asset's own annual growth rate", () => {
  const details = { age: 34, mutualFunds: 100, fixedDeposits: 100, realEstate: 100, bankSavings: 0, monthlyIncome: 0, monthlyExpense: 0 };
  assert.equal(calculations.corpusAtRetirement(details, noDependents, noLoan, 35, 0), 324);
});

test("keeps new contributions in a separate 4% savings bucket", () => {
  const details = { age: 34, mutualFunds: 0, fixedDeposits: 0, realEstate: 0, bankSavings: 0, monthlyIncome: 10, monthlyExpense: 0 };
  assert.ok(Math.abs(calculations.corpusAtRetirement(details, noDependents, noLoan, 36, 10) - 252) < 0.0001);
});

test("grows the starting bank-savings balance at 4%", () => {
  const details = { age: 34, mutualFunds: 0, fixedDeposits: 0, realEstate: 0, bankSavings: 100, monthlyIncome: 0, monthlyExpense: 0 };
  assert.equal(calculations.corpusAtRetirement(details, noDependents, noLoan, 35, 0), 104);
});

test("applies annual dependent cost for every dependent", () => {
  const details = { age: 90, mutualFunds: 180, fixedDeposits: 0, realEstate: 0, bankSavings: 0, monthlyIncome: 0, monthlyExpense: 0 };
  const dependents = { count: 2, annualCostPerDependent: 100, supportYears: 10 };
  assert.equal(calculations.corpusLastsToLifeExpectancy(details, dependents, noLoan, 90, 0, 0), false);
});

test("does not invent a future retirement age for an unsustainable zero-income plan", () => {
  const details = { age: 34, mutualFunds: 10_000_000, fixedDeposits: 0, realEstate: 0, bankSavings: 0, monthlyIncome: 0, monthlyExpense: 100_000 };
  assert.equal(calculations.retirementAgeFor(details, noDependents, noLoan), null);
});

test("requires the corpus to fund the age-90 expense", () => {
  const details = { age: 89, mutualFunds: 100, fixedDeposits: 0, realEstate: 0, bankSavings: 0, monthlyIncome: 0, monthlyExpense: 5 };
  assert.equal(calculations.corpusLastsToLifeExpectancy(details, noDependents, noLoan, 89, 0, 5), false);
});

test("returns an age only when that age is sustainable through 90", () => {
  const details = { age: 34, mutualFunds: 30_000_000, fixedDeposits: 0, realEstate: 0, bankSavings: 0, monthlyIncome: 200_000, monthlyExpense: 60_000 };
  const age = calculations.retirementAgeFor(details, noDependents, noLoan);
  assert.notEqual(age, null);
  assert.equal(calculations.corpusLastsToLifeExpectancy(details, noDependents, noLoan, age, 140_000, 60_000), true);
  if (age > details.age) {
    assert.equal(calculations.corpusLastsToLifeExpectancy(details, noDependents, noLoan, age - 1, 140_000, 60_000), false);
  }
});
