import { redirect } from "next/navigation";
import { getPermissions, can } from "@/lib/permissions";
import CreditCardClient from "@/components/credit-card/CreditCardClient";

export default async function CreditCardPage() {
  const perms = await getPermissions();
  if (!can(perms, "credit-card")) redirect("/");

  return <CreditCardClient />;
}
