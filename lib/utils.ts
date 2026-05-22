import type { Term } from "@/lib/types";

const START_YEAR = 2020;

export function generateTerms(): Term[] {
  const today = new Date();
  const currentTerm =
    today.getFullYear() - START_YEAR + (today.getMonth() >= 7 ? 1 : 0);
  const terms: Term[] = [];
  for (let i = 1; i <= currentTerm; i++) {
    const beginYear = START_YEAR + i - 1;
    const endYear = beginYear + 1;
    terms.push({
      label: `${i}期目`,
      value: i,
      start: `${beginYear}-08`,
      end: `${endYear}-07`,
    });
  }
  return terms;
}

export function getMonthsInTerm(term: Term): string[] {
  const [startYear, startMonth] = term.start.split("-").map(Number);
  const [endYear, endMonth] = term.end.split("-").map(Number);
  const months: string[] = [];
  for (let m = startMonth; m <= 12; m++) {
    months.push(`${startYear}-${String(m).padStart(2, "0")}`);
  }
  for (let m = 1; m <= endMonth; m++) {
    months.push(`${endYear}-${String(m).padStart(2, "0")}`);
  }
  return months;
}

export function formatYen(value: number): string {
  return `¥${Math.round(value).toLocaleString("ja-JP")}`;
}

export function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
