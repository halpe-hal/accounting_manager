"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/app/actions/auth";
import DepreciationToggle from "@/components/DepreciationToggle";

const NAV_ITEMS = [
  { label: "ダッシュボード",          href: "/",                  permKey: "dashboard" },
  { label: "【税抜】ダッシュボード",  href: "/dashboard-excl-tax", permKey: "dashboard-excl-tax" },
  { label: "グラフ分析",              href: "/graph-analysis",     permKey: "graph-analysis" },
  { label: "月別入出金管理",          href: "/monthly-io",         permKey: "monthly-io" },
  { label: "固定費管理",              href: "/fixed-expense",      permKey: "fixed-expense" },
  { label: "クレカ明細取込",          href: "/credit-card",        permKey: "credit-card" },
  { label: "※本部用",                href: "/honbu",              permKey: "honbu" },
  { label: "設定",                    href: "/settings",           permKey: "settings" },
];

interface Props {
  isAdmin?: boolean;
  perms?: Set<string>;
  depreciationMode?: boolean;
}

export default function Sidebar({ isAdmin = false, perms = new Set(), depreciationMode = false }: Props) {
  const pathname = usePathname();
  const hasAll = perms.has("*");

  return (
    <aside className="w-56 h-screen bg-white border-r border-gray-200 flex flex-col py-6 px-3 flex-shrink-0">
      <div className="flex items-center gap-2 px-2 mb-4">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ backgroundColor: "#006a38" }}
        >
          L
        </div>
        <span className="font-bold text-gray-800 text-sm">Lia 管理会計</span>
      </div>

      {isAdmin && (
        <div className="mb-4 px-0">
          <DepreciationToggle isDepreciation={depreciationMode} />
        </div>
      )}

      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => {
          const allowed = hasAll || perms.has(item.permKey);
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                !allowed
                  ? "text-gray-300 cursor-default pointer-events-none"
                  : isActive
                    ? "text-white"
                    : "text-gray-600 hover:bg-gray-100"
              }`}
              style={allowed && isActive ? { backgroundColor: "#006a38" } : {}}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {isAdmin && (
        <div className="mb-2 space-y-1">
          <div className="border-t border-gray-200 my-2" />
          <Link
            href="/admin"
            className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === "/admin"
                ? "text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
            style={pathname === "/admin" ? { backgroundColor: "#006a38" } : {}}
          >
            ページ権限管理
          </Link>
          <Link
            href="/admin/divisions"
            className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === "/admin/divisions"
                ? "text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
            style={pathname === "/admin/divisions" ? { backgroundColor: "#006a38" } : {}}
          >
            事業部アクセス管理
          </Link>
          <Link
            href="/admin/dashboard-limit"
            className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              pathname === "/admin/dashboard-limit"
                ? "text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
            style={pathname === "/admin/dashboard-limit" ? { backgroundColor: "#006a38" } : {}}
          >
            ダッシュボード表示制限
          </Link>
        </div>
      )}

      <div className="pt-4 border-t border-gray-200">
        <form action={logout}>
          <button
            type="submit"
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 transition-colors"
          >
            ログアウト
          </button>
        </form>
      </div>
    </aside>
  );
}
