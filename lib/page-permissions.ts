export const ADMIN_EMAILS = ["admin@kklia.com", "nishimura@kklia.com"];

export const PAGE_PERMISSIONS = [
  { key: "dashboard",          label: "ダッシュボード" },
  { key: "dashboard-excl-tax", label: "【税抜】ダッシュボード" },
  { key: "honbu",              label: "※本部用" },
  { key: "graph-analysis",     label: "グラフ分析" },
  { key: "monthly-io",         label: "月別入出金管理" },
  { key: "fixed-expense",      label: "固定費管理" },
  { key: "settings",           label: "設定" },
] as const;

export type PagePermissionKey = (typeof PAGE_PERMISSIONS)[number]["key"];
