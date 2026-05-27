"use client";

import { useState, useTransition, useMemo } from "react";
import { addEmployee, updateEmployee, deleteEmployee, updateRates } from "@/app/actions/social-insurance";
import type { SocialInsuranceEmployee, Division, SocialInsuranceRates } from "@/lib/types";
import ReflectModal, { type DivisionItem } from "./ReflectModal";

interface Props {
  employees: SocialInsuranceEmployee[];
  divisions: Division[];
  rates: SocialInsuranceRates;
  reflections: Array<{ year: number; month: number }>;
}

type EditState = {
  name: string;
  remuneration: number;
  division: string;
  enrollmentYear: string;
  enrollmentMonth: string;
};

function formatYen(n: number) {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

function formatEnrollment(year: number | null, month: number | null) {
  if (!year || !month) return "-";
  return `${year}年${month}月`;
}

const now = new Date();
const YEARS = Array.from({ length: 30 }, (_, i) => now.getFullYear() - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

type RatesState = {
  health_insurance_rate: string;
  child_support_rate: string;
  pension_rate: string;
  child_contribution_rate: string;
};

function ratesToState(r: SocialInsuranceRates): RatesState {
  return {
    health_insurance_rate: r.health_insurance_rate ? String(r.health_insurance_rate) : "",
    child_support_rate: r.child_support_rate ? String(r.child_support_rate) : "",
    pension_rate: r.pension_rate ? String(r.pension_rate) : "",
    child_contribution_rate: r.child_contribution_rate ? String(r.child_contribution_rate) : "",
  };
}

export default function SocialInsuranceClient({ employees: initialEmployees, divisions, rates: initialRates, reflections: initialReflections }: Props) {
  const [employees, setEmployees] = useState(initialEmployees);
  const [ratesState, setRatesState] = useState<RatesState>(() => ratesToState(initialRates));
  const [ratesEditing, setRatesEditing] = useState(false);
  const [reflectTarget, setReflectTarget] = useState<{ year: number; month: number; divisions: DivisionItem[] } | null>(null);
  const [reflectedKeys, setReflectedKeys] = useState<Set<string>>(
    () => new Set(initialReflections.map((r) => `${r.year}-${r.month}`))
  );

  const summary = useMemo(() => {
    const now = new Date();
    const cy = now.getFullYear();
    const cm = now.getMonth() + 1;
    const py = cm === 1 ? cy - 1 : cy;
    const pm = cm === 1 ? 12 : cm - 1;

    const h  = Number(ratesState.health_insurance_rate)  / 100;
    const cs = Number(ratesState.child_support_rate)     / 100;
    const p  = Number(ratesState.pension_rate)           / 100;
    const cc = Number(ratesState.child_contribution_rate)/ 100;

    // 50銭以下切捨て、50銭超切上げ
    function roundKosen(v: number): number {
      const frac = v - Math.floor(v);
      return frac <= 0.5 ? Math.floor(v) : Math.ceil(v);
    }

    function calc(year: number, month: number) {
      const active = employees.filter((emp) => {
        if (!emp.enrollment_year || !emp.enrollment_month) return true;
        return emp.enrollment_year < year || (emp.enrollment_year === year && emp.enrollment_month <= month);
      });
      let employer = 0, employee = 0;
      const divMap = new Map<string, { employer: number; employee: number }>();
      for (const emp of active) {
        const r = emp.standard_monthly_remuneration;
        const empEmployee = roundKosen(r * h / 2 + r * cs / 2 + r * p / 2);
        const empEmployer = roundKosen(r * h / 2 + r * cs / 2 + r * p / 2 + r * cc);
        employee += empEmployee;
        employer += empEmployer;
        const prev = divMap.get(emp.division) ?? { employer: 0, employee: 0 };
        divMap.set(emp.division, { employer: prev.employer + empEmployer, employee: prev.employee + empEmployee });
      }
      const divisions: DivisionItem[] = Array.from(divMap.entries()).map(([division, v]) => ({
        division,
        employer: Math.floor(v.employer),
        employee: Math.floor(v.employee),
      }));
      return {
        employer: Math.floor(employer),
        employee: Math.floor(employee),
        total: Math.floor(employer + employee),
        activeCount: active.length,
        divisions,
      };
    }

    return {
      current: { label: `${cy}年${cm}月`, ...calc(cy, cm) },
      prev:    { label: `${py}年${pm}月`, ...calc(py, pm) },
    };
  }, [employees, ratesState]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState>({ name: "", remuneration: 0, division: "", enrollmentYear: "", enrollmentMonth: "" });
  const [adding, setAdding] = useState(false);
  const [newState, setNewState] = useState<EditState>({ name: "", remuneration: 0, division: divisions[0]?.name ?? "", enrollmentYear: "", enrollmentMonth: "" });
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isPending, startTransition] = useTransition();

  function showMsg(msg: string, error = false) {
    setMessage(msg);
    setIsError(error);
    setTimeout(() => setMessage(""), 3000);
  }

  function startEdit(emp: SocialInsuranceEmployee) {
    setEditingId(emp.id);
    setEditState({
      name: emp.name,
      division: emp.division,
      remuneration: emp.standard_monthly_remuneration,
      enrollmentYear: emp.enrollment_year ? String(emp.enrollment_year) : "",
      enrollmentMonth: emp.enrollment_month ? String(emp.enrollment_month) : "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function handleSaveRates() {
    startTransition(async () => {
      const result = await updateRates({
        health_insurance_rate: Number(ratesState.health_insurance_rate) || 0,
        child_support_rate: Number(ratesState.child_support_rate) || 0,
        pension_rate: Number(ratesState.pension_rate) || 0,
        child_contribution_rate: Number(ratesState.child_contribution_rate) || 0,
      });
      if (result?.error) { showMsg(result.error, true); return; }
      setRatesEditing(false);
      showMsg("保険料率を更新しました");
    });
  }

  function handleUpdate() {
    if (!editState.name.trim()) { showMsg("従業員名を入力してください", true); return; }
    const ey = editState.enrollmentYear ? Number(editState.enrollmentYear) : null;
    const em = editState.enrollmentMonth ? Number(editState.enrollmentMonth) : null;
    startTransition(async () => {
      const result = await updateEmployee(editingId!, editState.name.trim(), editState.remuneration, editState.division, ey, em);
      if (result?.error) { showMsg(result.error, true); return; }
      setEmployees((prev) =>
        prev.map((e) =>
          e.id === editingId
            ? { ...e, name: editState.name.trim(), standard_monthly_remuneration: editState.remuneration, division: editState.division, enrollment_year: ey, enrollment_month: em }
            : e
        )
      );
      setEditingId(null);
      showMsg("更新しました");
    });
  }

  function handleDelete(id: number, name: string) {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    startTransition(async () => {
      const result = await deleteEmployee(id);
      if (result?.error) { showMsg(result.error, true); return; }
      setEmployees((prev) => prev.filter((e) => e.id !== id));
      showMsg("削除しました");
    });
  }

  function handleAdd() {
    if (!newState.name.trim()) { showMsg("従業員名を入力してください", true); return; }
    const ey = newState.enrollmentYear ? Number(newState.enrollmentYear) : null;
    const em = newState.enrollmentMonth ? Number(newState.enrollmentMonth) : null;
    startTransition(async () => {
      const result = await addEmployee(newState.name.trim(), newState.remuneration, newState.division, ey, em);
      if ("error" in result) { showMsg(result.error, true); return; }
      setEmployees((prev) => [
        ...prev,
        {
          id: result.id,
          name: newState.name.trim(),
          standard_monthly_remuneration: newState.remuneration,
          division: newState.division,
          enrollment_year: ey,
          enrollment_month: em,
          sort_order: prev.length,
        },
      ]);
      setNewState({ name: "", remuneration: 0, division: divisions[0]?.name ?? "", enrollmentYear: "", enrollmentMonth: "" });
      setAdding(false);
      showMsg("追加しました");
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">社会保険料管理</h1>
        <button
          onClick={() => { setAdding(true); setEditingId(null); }}
          className="text-sm px-4 py-2 text-white rounded-xl"
          style={{ backgroundColor: "#006a38" }}
        >
          ＋ 従業員を追加
        </button>
      </div>

      {/* 保険料率 */}
      <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">保険料率</p>
          {!ratesEditing ? (
            <button
              onClick={() => setRatesEditing(true)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              編集
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => { setRatesEditing(false); setRatesState(ratesToState(initialRates)); }}
                className="text-xs px-3 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveRates}
                disabled={isPending}
                className="text-xs px-3 py-1 rounded-lg text-white disabled:opacity-50"
                style={{ backgroundColor: "#006a38" }}
              >
                {isPending ? "保存中..." : "保存"}
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              { key: "health_insurance_rate", label: "健康保険料" },
              { key: "child_support_rate", label: "子ども・子育て支援金" },
              { key: "pension_rate", label: "厚生年金保険料" },
              { key: "child_contribution_rate", label: "子ども・子育て拠出金" },
            ] as const
          ).map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs text-gray-500 mb-1">{label}</label>
              {ratesEditing ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.001"
                    value={ratesState[key]}
                    onChange={(e) => setRatesState((s) => ({ ...s, [key]: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:border-gray-400"
                  />
                  <span className="text-sm text-gray-500 whitespace-nowrap">%</span>
                </div>
              ) : (
                <p className="text-sm text-gray-800 py-1.5">
                  {ratesState[key] ? `${ratesState[key]}%` : "-"}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-2 gap-4">
        {([
          { ...summary.prev,    yearNum: summary.prev.label.match(/(\d+)年(\d+)月/)![1], monthNum: summary.prev.label.match(/(\d+)年(\d+)月/)![2] },
          { ...summary.current, yearNum: summary.current.label.match(/(\d+)年(\d+)月/)![1], monthNum: summary.current.label.match(/(\d+)年(\d+)月/)![2] },
        ]).map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-200 px-5 py-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">{s.label}
              <span className="ml-2 text-xs font-normal text-gray-400">({s.activeCount}名)</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "全体総額",   value: s.total,    color: "text-gray-800" },
                { label: "事業主負担", value: s.employer, color: "text-blue-700" },
                { label: "従業員負担", value: s.employee, color: "text-green-700" },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                  <p className={`text-base font-bold ${color}`}>{formatYen(value)}</p>
                </div>
              ))}
            </div>
            <div className="pt-1 border-t border-gray-100">
              {reflectedKeys.has(`${s.yearNum}-${s.monthNum}`) ? (
                <span className="text-xs text-gray-400">明細登録済み</span>
              ) : (
                <button
                  onClick={() => setReflectTarget({ year: Number(s.yearNum), month: Number(s.monthNum), divisions: s.divisions })}
                  disabled={s.divisions.length === 0}
                  className="text-xs px-3 py-1.5 rounded-lg text-white disabled:opacity-40"
                  style={{ backgroundColor: "#006a38" }}
                >
                  明細へ反映
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {reflectTarget && (
        <ReflectModal
          year={reflectTarget.year}
          month={reflectTarget.month}
          divisions={reflectTarget.divisions}
          onClose={() => setReflectTarget(null)}
          onSuccess={() => {
            setReflectedKeys((prev) => new Set([...prev, `${reflectTarget.year}-${reflectTarget.month}`]));
            setReflectTarget(null);
            showMsg("出金明細へ反映しました");
          }}
        />
      )}

      {message && (
        <div className={`px-4 py-2 rounded-xl text-sm ${isError ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
          {message}
        </div>
      )}

      {/* 追加フォーム */}
      {adding && (
        <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">新規追加</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">従業員名 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={newState.name}
                onChange={(e) => setNewState((s) => ({ ...s, name: e.target.value }))}
                autoFocus
                placeholder="例: 山田 太郎"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">標準報酬月額</label>
              <input
                type="number"
                value={newState.remuneration}
                onChange={(e) => setNewState((s) => ({ ...s, remuneration: Number(e.target.value) }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:border-gray-400"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">所属事業部</label>
              <select
                value={newState.division}
                onChange={(e) => setNewState((s) => ({ ...s, division: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
              >
                {divisions.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">加入年月</label>
              <div className="flex gap-1">
                <select
                  value={newState.enrollmentYear}
                  onChange={(e) => setNewState((s) => ({ ...s, enrollmentYear: e.target.value }))}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none"
                >
                  <option value="">年</option>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <select
                  value={newState.enrollmentMonth}
                  onChange={(e) => setNewState((s) => ({ ...s, enrollmentMonth: e.target.value }))}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none"
                >
                  <option value="">月</option>
                  {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => setAdding(false)}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              onClick={handleAdd}
              disabled={isPending}
              className="text-sm px-4 py-1.5 rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: "#006a38" }}
            >
              {isPending ? "追加中..." : "追加"}
            </button>
          </div>
        </div>
      )}

      {/* 従業員テーブル */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500">
              <th className="py-2 px-4 text-left font-medium border-b border-gray-200">従業員名</th>
              <th className="py-2 px-4 text-right font-medium border-b border-gray-200">標準報酬月額</th>
              <th className="py-2 px-4 text-left font-medium border-b border-gray-200">所属事業部</th>
              <th className="py-2 px-4 text-left font-medium border-b border-gray-200">加入年月</th>
              <th className="py-2 px-4 text-center font-medium border-b border-gray-200">操作</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-gray-400">
                  従業員が登録されていません
                </td>
              </tr>
            ) : (
              employees.map((emp) =>
                editingId === emp.id ? (
                  <tr key={emp.id} className="bg-blue-50">
                    <td className="py-1.5 px-3 border-b border-gray-100">
                      <input
                        type="text"
                        value={editState.name}
                        onChange={(e) => setEditState((s) => ({ ...s, name: e.target.value }))}
                        autoFocus
                        className="w-full border border-gray-200 rounded px-2 py-0.5 text-sm focus:outline-none"
                      />
                    </td>
                    <td className="py-1.5 px-3 border-b border-gray-100">
                      <input
                        type="number"
                        value={editState.remuneration}
                        onChange={(e) => setEditState((s) => ({ ...s, remuneration: Number(e.target.value) }))}
                        className="w-full border border-gray-200 rounded px-2 py-0.5 text-sm text-right focus:outline-none"
                      />
                    </td>
                    <td className="py-1.5 px-3 border-b border-gray-100">
                      <select
                        value={editState.division}
                        onChange={(e) => setEditState((s) => ({ ...s, division: e.target.value }))}
                        className="w-full border border-gray-200 rounded px-2 py-0.5 text-sm bg-white focus:outline-none"
                      >
                        {divisions.map((d) => (
                          <option key={d.id} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 px-3 border-b border-gray-100">
                      <div className="flex gap-1">
                        <select
                          value={editState.enrollmentYear}
                          onChange={(e) => setEditState((s) => ({ ...s, enrollmentYear: e.target.value }))}
                          className="flex-1 border border-gray-200 rounded px-1 py-0.5 text-sm bg-white focus:outline-none"
                        >
                          <option value="">年</option>
                          {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <select
                          value={editState.enrollmentMonth}
                          onChange={(e) => setEditState((s) => ({ ...s, enrollmentMonth: e.target.value }))}
                          className="flex-1 border border-gray-200 rounded px-1 py-0.5 text-sm bg-white focus:outline-none"
                        >
                          <option value="">月</option>
                          {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                    </td>
                    <td className="py-1.5 px-3 border-b border-gray-100 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={handleUpdate}
                          disabled={isPending}
                          className="text-xs px-2 py-1 rounded text-white disabled:opacity-50"
                          style={{ backgroundColor: "#006a38" }}
                        >
                          保存
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                        >
                          取消
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={emp.id} className="hover:bg-gray-50">
                    <td className="py-2 px-4 text-gray-800 border-b border-gray-100">{emp.name}</td>
                    <td className="py-2 px-4 text-right text-gray-800 border-b border-gray-100">{formatYen(emp.standard_monthly_remuneration)}</td>
                    <td className="py-2 px-4 text-gray-700 border-b border-gray-100">{emp.division}</td>
                    <td className="py-2 px-4 text-gray-700 border-b border-gray-100">{formatEnrollment(emp.enrollment_year, emp.enrollment_month)}</td>
                    <td className="py-2 px-4 border-b border-gray-100 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => startEdit(emp)}
                          className="text-xs text-blue-600 hover:text-blue-800"
                        >
                          編集
                        </button>
                        <button
                          onClick={() => handleDelete(emp.id, emp.name)}
                          disabled={isPending}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          削除
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
