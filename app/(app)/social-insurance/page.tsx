import { getDivisions } from "@/app/actions/dashboard";
import { getEmployees, getRates, getReflections, getRemunerationChanges } from "@/app/actions/social-insurance";
import SocialInsuranceClient from "@/components/social-insurance/SocialInsuranceClient";

export default async function SocialInsurancePage() {
  const [employees, divisions, rates, reflections, remunerationChanges] = await Promise.all([
    getEmployees(),
    getDivisions(),
    getRates(),
    getReflections(),
    getRemunerationChanges(),
  ]);

  return (
    <SocialInsuranceClient
      employees={employees}
      divisions={divisions}
      rates={rates}
      reflections={reflections}
      remunerationChanges={remunerationChanges}
    />
  );
}
