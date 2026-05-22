import {
  getDivisionsForSettings,
  getExpenseCategories,
  getIncomeSources,
  getDefaultPartners,
  getAccountItems,
  getExpenseTargets,
} from "@/app/actions/settings";
import SettingsClient from "@/components/settings/SettingsClient";

export default async function SettingsPage() {
  const [divisions, expenseCategories, incomeSources, defaultPartners, accountItems, expenseTargets] =
    await Promise.all([
      getDivisionsForSettings(),
      getExpenseCategories(),
      getIncomeSources(),
      getDefaultPartners(),
      getAccountItems(),
      getExpenseTargets(),
    ]);

  return (
    <SettingsClient
      divisions={divisions}
      expenseCategories={expenseCategories}
      incomeSources={incomeSources}
      defaultPartners={defaultPartners}
      accountItems={accountItems}
      expenseTargets={expenseTargets}
    />
  );
}
