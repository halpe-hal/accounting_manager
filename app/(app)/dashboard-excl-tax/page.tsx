import { redirect } from "next/navigation";
import { getDivisionsContext, getCurrentUserDashboardRowLimit } from "@/app/actions/dashboard";
import { getPermissions, can } from "@/lib/permissions";
import DashboardClient from "@/components/dashboard/DashboardClient";

export default async function DashboardExclTaxPage() {
  const perms = await getPermissions();
  if (!can(perms, "dashboard-excl-tax")) redirect("/");

  const [{ divisions, allDivisions }, rowLimit] = await Promise.all([
    getDivisionsContext(),
    getCurrentUserDashboardRowLimit(),
  ]);
  return <DashboardClient divisions={divisions} allDivisions={allDivisions} taxIncluded={false} rowLimit={rowLimit ?? undefined} />;
}
