import { cookies } from "next/headers";

export async function isDepreciationMode(): Promise<boolean> {
  const c = await cookies();
  return c.get("depreciation_mode")?.value === "1";
}
