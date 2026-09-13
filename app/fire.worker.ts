import { calculatePlan, projectScenario, recommendationsFor } from "@/lib/fire-model";
import type { Dependents, Details, Loan } from "@/lib/fire-model";

self.onmessage = (event: MessageEvent<{ kind: "plan" | "calculate" | "recommend"; details: Details; dependents: Dependents; loan: Loan; targetAge?: number }>) => {
  const { kind, details, dependents, loan, targetAge } = event.data;
  self.postMessage(kind === "recommend"
    ? { kind, recommendation: recommendationsFor(details, dependents, loan, targetAge ?? details.age), projection: projectScenario(details, dependents, loan, targetAge ?? details.age) }
    : { kind, plan: calculatePlan(details, dependents, loan) });
};
