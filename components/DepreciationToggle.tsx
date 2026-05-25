"use client";

import { useTransition } from "react";
import { setDepreciationMode } from "@/app/actions/auth";

export default function DepreciationToggle({ isDepreciation }: { isDepreciation: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await setDepreciationMode(!isDepreciation);
      window.location.reload();
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
        isDepreciation
          ? "bg-orange-100 text-orange-700 border-orange-300 hover:bg-orange-200"
          : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
      } disabled:opacity-50`}
    >
      {isPending ? "切替中..." : isDepreciation ? "デフォルトへ戻す" : "減価償却反映"}
    </button>
  );
}
