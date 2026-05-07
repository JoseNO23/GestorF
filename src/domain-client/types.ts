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
  created_at: string;
  updated_at: string;
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
  archived_at: string | null;
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
}

export interface UpdateEventInput {
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

export interface UpsertStatusRulesInput {
  applies_to: string;
  counts_as_paid: boolean;
  affects_real: boolean;
  affects_available: boolean;
  affects_future: boolean;
  creates_alert: boolean;
  exclude_from_total_default: boolean;
}
