import { getDivisions } from "@/app/actions/dashboard";
import { getEmployees, getRates, getReflections } from "@/app/actions/social-insurance";
import SocialInsuranceClient from "@/components/social-insurance/SocialInsuranceClient";

export default async function SocialInsurancePage() {
  const [employees, divisions, rates, reflections] = await Promise.all([
    getEmployees(),
    getDivisions(),
    getRates(),
    getReflections(),
  ]);

  return (
    <SocialInsuranceClient employees={employees} divisions={divisions} rates={rates} reflections={reflections} />
  );
}
