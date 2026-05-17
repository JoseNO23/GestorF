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
  // Dinero propio (nunca incluye TC)
  dinero_real: number;
  dinero_disponible: number;
  dinero_futuro: number;
  // Mes actual
  total_ingresos: number;
  total_ingresos_esperados: number;
  total_gastos: number;
  alertas_vencidos: number;
  // Crédito TC — separado, nunca mezclado con dinero propio
  tc_deuda_total: number;
  tc_disponible_total: number;
  tc_limite_total: number;
  movimientos_recientes: FinancialEventRow[];
}

export interface FinancialEventRow {
  id: number;
  period_id: number;
  event_type: string;
  title: string;
  amount_minor: number;
  expected_amount_minor: number | null;
  received_amount_minor: number | null;
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
  purchase_id: number | null;
  installment_number: number | null;
  requires_amount_confirmation: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreditCardPurchase {
  id: number;
  payment_method_id: number;
  title: string;
  total_amount_minor: number;
  installments: number;
  interest_type: 'none' | 'fixed';
  monthly_interest_rate: number;
  installment_amount_minor: number;
  total_with_interest_minor: number;
  category_id: number | null;
  purchase_date: string;
  notes: string | null;
  created_at: string;
}

export interface CreditCardPurchaseWithProgress {
  id: number;
  payment_method_id: number;
  title: string;
  total_amount_minor: number;
  installments: number;
  installment_amount_minor: number;
  total_with_interest_minor: number;
  interest_type: string;
  monthly_interest_rate: number;
  category_id: number | null;
  purchase_date: string;
  notes: string | null;
  installments_generated: number;
  installments_paid: number;
}

export interface InstallmentPreview {
  installment_amount_minor: number;
  total_with_interest_minor: number;
  total_interest_minor: number;
}

export interface RecurringRule {
  id: number;
  event_type: 'income' | 'expense';
  title: string;
  amount_minor: number;
  amount_type: 'fixed' | 'variable';
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
  scope: 'income' | 'expense' | 'both';
  archived_at: string | null;
  system_key: string | null; // semántica interna — null en estados personalizados
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
  // Global (acumulado histórico — no resetea por mes)
  current_debt_minor: number;
  available_minor: number;
  // Mensual (informativo del período visible)
  month_purchases_minor: number;
  month_payments_minor: number;
}

export interface Account {
  id: number;
  name: string;
  kind: 'asset' | 'liability' | 'receivable';
  opening_balance_minor: number;
  archived_at: string | null;
}

export interface Profile {
  id: string;
  name: string;
  db_file: string;
  created_at: string;
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
  received_amount_minor?: number;
  event_date: string;
  due_date?: string;
  status_id: number;
  category_id?: number;
  payment_method_id?: number;
  parent_event_id?: number;
  exclude_from_total: boolean;
  notes?: string;
  requires_amount_confirmation?: boolean; // omitir = conserva valor existente
}

export interface PeriodEvolution {
  year: number;
  month: number;
  total_ingresos: number;          // cobrados (received_amount_minor)
  total_ingresos_esperados: number; // nominales (amount_minor)
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

export type NotificationPriority = 'info' | 'warning' | 'critical';

export type NotificationType =
  | 'income_overdue'
  | 'income_due'
  | 'expense_overdue'
  | 'expense_due'
  | 'expense_upcoming'
  | 'credit_card_due';

export interface NotificationItem {
  key: string;
  notif_type: NotificationType;
  source_type: 'event' | 'payment_method';
  source_id: number;
  title: string;
  message: string;
  priority: NotificationPriority;
  due_date: string | null;
  route_to: string;
  read_at: string | null;
  /** Descarte temporal (7 días). No indica que el problema financiero fue resuelto. */
  dismissed_at: string | null;
}
