export const ADMIN_EMAILS = ["admin@kklia.com", "nishimura@kklia.com"];

export const PAGE_PERMISSIONS = [
  { key: "dashboard",          label: "ダッシュボード" },
  { key: "dashboard-excl-tax", label: "【税抜】ダッシュボード" },
  { key: "honbu",              label: "※本部用" },
  { key: "graph-analysis",     label: "グラフ分析" },
  { key: "monthly-io",         label: "月別入出金管理" },
  { key: "fixed-expense",      label: "固定費管理" },
  { key: "settings",           label: "設定" },
  { key: "credit-card",        label: "クレカ明細取込" },
  { key: "bank",               label: "銀行明細取込" },
  { key: "social-insurance",   label: "社会保険料管理" },
] as const;

export type PagePermissionKey = (typeof PAGE_PERMISSIONS)[number]["key"];
