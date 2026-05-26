import { getDivisions } from "@/app/actions/dashboard";
import { getExpenseCategories, getIncomeSources, getDefaultPartners, getAccountItems, getFixedCategories } from "@/app/actions/settings";
import { getPermissions, ADMIN_EMAILS } from "@/lib/permissions";
import { isDepreciationMode } from "@/lib/depreciation-mode";
import { createClient } from "@/lib/supabase/server";
import MonthlyIOClient from "@/components/monthly-io/MonthlyIOClient";

export default async function MonthlyIOPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin = ADMIN_EMAILS.includes(user?.email ?? "");
  const depreciationMode = isAdmin ? await isDepreciationMode() : false;

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
      isAdmin={isAdmin}
      depreciationMode={depreciationMode}
    />
  );
}
