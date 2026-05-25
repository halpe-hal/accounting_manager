import { redirect } from "next/navigation";
import { getDivisionsContext, getCurrentUserDashboardRowLimit } from "@/app/actions/dashboard";
import { getPermissions, can } from "@/lib/permissions";
import DashboardClient from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const perms = await getPermissions();
  if (!can(perms, "dashboard")) {
    if (can(perms, "dashboard-excl-tax")) redirect("/dashboard-excl-tax");
    else if (can(perms, "graph-analysis")) redirect("/graph-analysis");
    else if (can(perms, "monthly-io")) redirect("/monthly-io");
    else if (can(perms, "fixed-expense")) redirect("/fixed-expense");
    else if (can(perms, "settings")) redirect("/settings");
  }

  const [{ divisions, allDivisions }, rowLimit] = await Promise.all([
    getDivisionsContext(),
    getCurrentUserDashboardRowLimit(),
  ]);
  return <DashboardClient divisions={divisions} allDivisions={allDivisions} taxIncluded={true} rowLimit={rowLimit ?? undefined} />;
}
