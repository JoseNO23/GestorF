// Tipos TypeScript espejo de los structs Rust.
// Todos los montos son i64 en centavos — usar formatMoney() para mostrar.

export interface Period {
  id: number;
  year: number;
  month: number;
  starts_on: string;
  ends_on: string;
  closed_at: string | null;
}

export interface DashboardData {
  period: Period;
  dinero_real: number;
  dinero_disponible: number;
  dinero_futuro: number;
  total_ingresos: number;
  total_gastos: number;
  alertas_vencidos: number;
  movimientos_recientes: FinancialEventRow[];
}

export interface FinancialEventRow {
  id: number;
  period_id: number;
  event_type: string;
  title: string;
  amount_minor: number;
  event_date: string;
  due_date: string | null;
  status_id: number;
  category_id: number | null;
  payment_method_id: number | null;
  source_account_id: number | null;
  target_account_id: number | null;
  liability_account_id: number | null;
  parent_event_id: number | null;
  exclude_from_total: boolean;
  notes: string | null;
  recurring_rule_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringRule {
  id: number;
  event_type: 'income' | 'expense';
  title: string;
  amount_minor: number;
  frequency: 'monthly' | 'biweekly' | 'weekly' | 'custom';
  day_of_month: number | null;
  interval_days: number | null;
  category_id: number | null;
  payment_method_id: number | null;
  default_status_id: number | null;
  starts_on: string;
  ends_on: string | null;
  remind_days_before: number | null;
  notes: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  scope: 'income' | 'expense' | 'both';
  archived_at: string | null;
}

export interface Status {
  id: number;
  name: string;
  color: string;
  sort_order: number;
  archived_at: string | null;
}

export interface StatusRuleRow {
  status_id: number;
  applies_to: string;
  counts_as_paid: boolean;
  affects_real: boolean;
  affects_available: boolean;
  affects_future: boolean;
  creates_alert: boolean;
  exclude_from_total_default: boolean;
}

export interface StatusWithRules {
  status: Status;
  rules: StatusRuleRow[];
}

export interface PaymentMethod {
  id: number;
  name: string;
  kind: 'cash' | 'debit' | 'credit' | 'transfer' | 'other';
  asset_account_id: number | null;
  liability_account_id: number | null;
  credit_limit_minor: number;
  cut_day: number | null;
  payment_due_day: number | null;
  archived_at: string | null;
}

export interface CreditCardBalance {
  id: number;
  name: string;
  credit_limit_minor: number;
  cut_day: number | null;
  payment_due_day: number | null;
  balance_used_minor: number;
  available_minor: number;
}

export interface Account {
  id: number;
  name: string;
  kind: 'asset' | 'liability' | 'receivable';
  opening_balance_minor: number;
  archived_at: string | null;
}

// ── Inputs para commands ───────────────────────────────────────────────────

export interface CreateEventInput {
  period_id: number;
  event_type: string;
  title: string;
  amount_minor: number;
  event_date: string;
  due_date?: string;
  status_id: number;
  category_id?: number;
  payment_method_id?: number;
  parent_event_id?: number;
  exclude_from_total: boolean;
  notes?: string;
  recurring_rule_id?: number;
}

export interface UpdateEventInput {
  event_type?: string; // si se omite, conserva el tipo existente en DB
  title: string;
  amount_minor: number;
  event_date: string;
  due_date?: string;
  status_id: number;
  category_id?: number;
  payment_method_id?: number;
  parent_event_id?: number;
  exclude_from_total: boolean;
  notes?: string;
}

export interface PeriodEvolution {
  year: number;
  month: number;
  total_ingresos: number;
  total_gastos: number;
}

export interface UpsertStatusRulesInput {
  applies_to: string;
  counts_as_paid: boolean;
  affects_real: boolean;
  affects_available: boolean;
  affects_future: boolean;
  creates_alert: boolean;
  exclude_from_total_default: boolean;
}
