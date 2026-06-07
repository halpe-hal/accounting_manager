// ---- 事業部 ----
export type Division = {
  id: number;
  name: string;
  type: string | null;
  brand: string | null;
  tag: string | null;
  sort_order: number;
};

// ---- 売上 ----
export type Sale = {
  id: number;
  year: number;
  month: number;
  partner: string;
  detail: string;
  expected_amount: number;
  received_amount: number;
  payment: string;
  top_category: string;
  invoice_issued: boolean;
  tax_rate: string;
  updated_at: string;
};

export type SalesTotal = {
  id: number;
  year: number;
  month: number;
  top_category: string;
  tax_rate: string;
  total_amount: number;
  updated_at: string;
};

// ---- 経費 ----
export type Expense = {
  id: number;
  year: number;
  month: number;
  partner: string;
  account: string;
  detail: string;
  payment: string;
  cost: number;
  second_category: string;
  top_category: string;
  updated_at: string;
  from_fixed?: boolean;
};

export type ExpenseTotal = {
  id: number;
  year: number;
  month: number;
  second_category: string;
  top_category: string;
  total_cost: number;
  updated_at: string;
};

// ---- 固定費 ----
export type FixedCategory = {
  id: number;
  top_category: string;
  second_category: string;
  partner: string;
  account: string;
  detail: string;
  cost: number;
  payment: string;
};

// ---- 経費カテゴリ ----
export type ExpenseCategory = {
  id: number;
  name: string;
  top_category: string;
  is_fixed: boolean;
  sort_order: number;
};

// ---- 経費目標 ----
export type ExpenseTarget = {
  id: number;
  top_category: string;
  cost_rate: number;
  labor_rate: number;
  fl_rate: number;
  utility_rate: number;
  misc_rate: number;
  other_fixed_rate: number;
  rent_rate: number;
  flr_rate: number;
  ad_rate: number;
  first_op_profit_rate: number;
};

// ---- 収入源 ----
export type IncomeSource = {
  id: number;
  top_category: string;
  partner: string;
  detail: string;
  expected_amount: number;
  received_amount: number;
  payment: string;
  tax_rate: string;
  sort_order?: number;
};

// ---- 取引先デフォルト ----
export type DefaultPartner = {
  id: number;
  top_category: string;
  second_category: string;
  partner: string;
  account: string;
  detail: string;
  payment: string;
  sort_order?: number;
};

// ---- 科目 ----
export type AccountItem = {
  id: number;
  name: string;
  sort_order?: number;
};

// ---- PL行 ----
export type PLRow = {
  label: string;
  isRate: boolean;
  values: Record<string, number>;
  targetRate?: number;
};

// ---- 期 ----
export type Term = {
  label: string;
  value: number;
  start: string;
  end: string;
};

// ---- 社会保険料従業員 ----
export type SocialInsuranceEmployee = {
  id: number;
  name: string;
  standard_monthly_remuneration: number;
  division: string;
  enrollment_year: number | null;
  enrollment_month: number | null;
  sort_order: number;
  updated_at?: string;
};

// ---- 社会保険料 月額変更（随時改定） ----
export type SocialInsuranceRemunerationChange = {
  id: number;
  employee_id: number;
  change_year: number;
  change_month: number;
  standard_monthly_remuneration: number;
  created_at?: string;
};

// ---- 社会保険料率 ----
export type SocialInsuranceRates = {
  health_insurance_rate: number;
  child_support_rate: number;
  pension_rate: number;
  child_contribution_rate: number;
  updated_at?: string;
};

// ---- ユーザー権限 ----
export type UserPermission = {
  id: number;
  user_id: string;
  app_name: string;
  email?: string;
};
