import type { Division } from "./types";

export type DivisionTab = {
  key: string;
  label: string;
  badge?: string;
  isAggregate: boolean;
};

export function divisionDisplayName(d: { name: string; tag?: string | null }): string {
  return d.tag ? `[${d.tag}]-${d.name}` : d.name;
}

function isHonbu(d: Division): boolean {
  return d.name.includes("事業本部") || (d.type ?? "").includes("事業本部");
}

export const LIA_ALL_KEY = "Lia全体合計";
export const ALL_EXCEPT_HONBU_KEY = "全事業部合計（事業本部除く）";

// allDivisions を渡すと一般ユーザーモード：全体合計・業態合計を非表示、完全アクセスのブランドのみブランド合計を表示
export function buildDivisionTabs(divisions: Division[], allDivisions?: Division[]): DivisionTab[] {
  const tabs: DivisionTab[] = [];
  const isUserMode = allDivisions !== undefined;

  if (!isUserMode) {
    // 管理者モード：全集計を表示
    tabs.push({ key: LIA_ALL_KEY, label: "Lia全体合計", isAggregate: true });
    if (divisions.some((d) => !isHonbu(d))) {
      tabs.push({ key: ALL_EXCEPT_HONBU_KEY, label: "全事業部合計（事業本部除く）", isAggregate: true });
    }
    const typeCount = new Map<string, number>();
    for (const d of divisions) {
      if (d.type) typeCount.set(d.type, (typeCount.get(d.type) ?? 0) + 1);
    }
    for (const [type, count] of typeCount) {
      if (count >= 2) {
        tabs.push({ key: `業態:${type}`, label: type, badge: "業態合計", isAggregate: true });
      }
    }
    const brandCount = new Map<string, number>();
    for (const d of divisions) {
      if (d.brand) brandCount.set(d.brand, (brandCount.get(d.brand) ?? 0) + 1);
    }
    for (const [brand, count] of brandCount) {
      if (count >= 2) {
        tabs.push({ key: `ブランド:${brand}`, label: brand, badge: "ブランド合計", isAggregate: true });
      }
    }
  } else {
    // 一般ユーザーモード：同一ブランドの全事業部にアクセス可能な場合のみブランド合計を表示
    const userNames = new Set(divisions.map((d) => d.name));
    const allBrandGroups: Record<string, string[]> = {};
    for (const d of allDivisions) {
      if (d.brand) allBrandGroups[d.brand] = [...(allBrandGroups[d.brand] ?? []), d.name];
    }
    for (const [brand, allBrandDivs] of Object.entries(allBrandGroups)) {
      if (allBrandDivs.length >= 2 && allBrandDivs.every((name) => userNames.has(name))) {
        tabs.push({ key: `ブランド:${brand}`, label: brand, badge: "ブランド合計", isAggregate: true });
      }
    }
  }

  // 各事業部・店舗（ブランド順）
  const sorted = [...divisions].sort((a, b) => {
    const ba = a.brand ?? "";
    const bb = b.brand ?? "";
    if (ba !== bb) return ba.localeCompare(bb, "ja");
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  for (const d of sorted) {
    tabs.push({ key: d.name, label: divisionDisplayName(d), isAggregate: false });
  }

  return tabs;
}

export function firstIndividualKey(divisions: Division[]): string {
  return sortDivisionsByBrand(divisions)[0]?.name ?? "";
}

// 個別事業部のみをブランド順で返す（集計タブ不要なページ用）
export function sortDivisionsByBrand(divisions: Division[]): Division[] {
  return [...divisions].sort((a, b) => {
    const ba = a.brand ?? "";
    const bb = b.brand ?? "";
    if (ba !== bb) return ba.localeCompare(bb, "ja");
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
}

export type VirtualOption = { key: string; label: string };

// Graph/Dashboard 用: allOptions（表示順） と virtualMap（集計キー→事業部名一覧）を返す
// allDivisions を渡すと一般ユーザーモード：全体合計・業態合計を非表示、完全アクセスのブランドのみブランド合計を表示
export function buildVirtualGroups(divisions: Division[], allDivisions?: Division[]): {
  allOptions: VirtualOption[];
  virtualMap: Record<string, string[]>;
} {
  const virtualMap: Record<string, string[]> = {};
  const allOptions: VirtualOption[] = [];
  const isUserMode = allDivisions !== undefined;

  if (!isUserMode) {
    allOptions.push({ key: LIA_ALL_KEY, label: "Lia全体合計" });

    const nonHonbu = divisions.filter((d) => !isHonbu(d)).map((d) => d.name);
    if (nonHonbu.length > 0) {
      allOptions.push({ key: ALL_EXCEPT_HONBU_KEY, label: "全事業部合計（事業本部除く）" });
      virtualMap[ALL_EXCEPT_HONBU_KEY] = nonHonbu;
    }

    const typeGroups: Record<string, string[]> = {};
    const brandGroups: Record<string, string[]> = {};
    for (const d of divisions) {
      if (d.type) typeGroups[d.type] = [...(typeGroups[d.type] ?? []), d.name];
      if (d.brand) brandGroups[d.brand] = [...(brandGroups[d.brand] ?? []), d.name];
    }
    for (const [t, divs] of Object.entries(typeGroups)) {
      if (divs.length >= 2) {
        const key = `${t}合計`;
        allOptions.push({ key, label: key });
        virtualMap[key] = divs;
      }
    }
    for (const [b, divs] of Object.entries(brandGroups)) {
      if (divs.length >= 2) {
        const key = `${b}合計`;
        allOptions.push({ key, label: key });
        virtualMap[key] = divs;
      }
    }
  } else {
    // 一般ユーザーモード：同一ブランドの全事業部にアクセス可能な場合のみブランド合計を表示
    const userNames = new Set(divisions.map((d) => d.name));
    const allBrandGroups: Record<string, string[]> = {};
    for (const d of allDivisions) {
      if (d.brand) allBrandGroups[d.brand] = [...(allBrandGroups[d.brand] ?? []), d.name];
    }
    for (const [brand, allBrandDivs] of Object.entries(allBrandGroups)) {
      if (allBrandDivs.length >= 2 && allBrandDivs.every((name) => userNames.has(name))) {
        const key = `${brand}合計`;
        allOptions.push({ key, label: key });
        virtualMap[key] = allBrandDivs;
      }
    }
  }

  // 個別事業部はブランド順・タグ付き表示名
  const sorted = [...divisions].sort((a, b) => {
    const ba = a.brand ?? "";
    const bb = b.brand ?? "";
    if (ba !== bb) return ba.localeCompare(bb, "ja");
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  for (const d of sorted) {
    allOptions.push({ key: d.name, label: divisionDisplayName(d) });
  }

  return { allOptions, virtualMap };
}
