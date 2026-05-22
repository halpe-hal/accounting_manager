import { getDivisions } from "@/app/actions/dashboard";
import { getExpenseCategories, getIncomeSources, getDefaultPartners, getAccountItems, getFixedCategories } from "@/app/actions/settings";
import MonthlyIOClient from "@/components/monthly-io/MonthlyIOClient";

export default async function MonthlyIOPage() {
  const [divisions, expenseCategories, incomeSources, defaultPartners, accountItems, fixedCategories] =
    await Promise.all([
      getDivisions(),
      getExpenseCategories(),
      getIncomeSources(),
      getDefaultPartners(),
      getAccountItems(),
      getFixedCategories(),
    ]);

  return (
    <MonthlyIOClient
      divisions={divisions}
      expenseCategories={expenseCategories}
      incomeSources={incomeSources}
      defaultPartners={defaultPartners}
      accountItems={accountItems}
      fixedCategories={fixedCategories}
    />
  );
}
