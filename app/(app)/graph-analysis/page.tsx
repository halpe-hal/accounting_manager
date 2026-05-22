import { getDivisionsContext } from "@/app/actions/dashboard";
import { getExpenseCategories, getExpenseTargets } from "@/app/actions/settings";
import GraphAnalysisClient from "@/components/graph/GraphAnalysisClient";

export default async function GraphAnalysisPage() {
  const [{ divisions, allDivisions }, expenseCategories, expenseTargets] = await Promise.all([
    getDivisionsContext(),
    getExpenseCategories(),
    getExpenseTargets(),
  ]);
  return (
    <GraphAnalysisClient
      divisions={divisions}
      allDivisions={allDivisions}
      expenseCategories={expenseCategories}
      expenseTargets={expenseTargets}
    />
  );
}
