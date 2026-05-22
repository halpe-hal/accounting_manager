import { getDivisions } from "@/app/actions/dashboard";
import { getFixedCategories, getExpenseCategories, getAccountItems } from "@/app/actions/settings";
import FixedExpenseClient from "@/components/fixed-expense/FixedExpenseClient";

export default async function FixedExpensePage() {
  const [divisions, fixedCategories, expenseCategories, accountItems] =
    await Promise.all([
      getDivisions(),
      getFixedCategories(),
      getExpenseCategories(),
      getAccountItems(),
    ]);

  return (
    <FixedExpenseClient
      divisions={divisions}
      fixedCategories={fixedCategories}
      expenseCategories={expenseCategories}
      accountItems={accountItems}
    />
  );
}
