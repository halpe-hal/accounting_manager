import { getDivisionsContext } from "@/app/actions/dashboard";
import DashboardClient from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const { divisions, allDivisions } = await getDivisionsContext();
  return <DashboardClient divisions={divisions} allDivisions={allDivisions} taxIncluded={true} />;
}
