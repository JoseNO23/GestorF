// Capa de aislamiento de Tauri.
// Todos los invoke() viven aquí. Al migrar a web, solo este archivo cambia.

import { invoke } from '@tauri-apps/api/core';
import type {
  Account,
  Category,
  CreateEventInput,
  CreditCardBalance,
  CreditCardPurchase,
  CreditCardPurchaseWithProgress,
  DashboardData,
  FinancialEventRow,
  InstallmentPreview,
  NotificationItem,
  PaymentMethod,
  Period,
  PeriodEvolution,
  Profile,
  RecurringRule,
  StatusWithRules,
  UpdateEventInput,
  UpsertStatusRulesInput,
} from './types';

// ── Perfiles ──────────────────────────────────────────────────────────────────

export const listProfiles = () =>
  invoke<Profile[]>('list_profiles');

export const getActiveProfileId = () =>
  invoke<string>('get_active_profile_id');

export const createProfile = (name: string) =>
  invoke<Profile>('create_profile', { name });

export const switchProfile = (id: string) =>
  invoke<void>('switch_profile', { id });

export const renameProfile = (id: string, name: string) =>
  invoke<void>('rename_profile', { id, name });

export const deleteProfile = (id: string) =>
  invoke<void>('delete_profile', { id });

// ── Dashboard ─────────────────────────────────────────────────────────────────

export const getDashboard = (periodId: number) =>
  invoke<DashboardData>('get_dashboard', { periodId });

export const getEvolution = (months: number) =>
  invoke<PeriodEvolution[]>('get_evolution', { months });

// ── Períodos ──────────────────────────────────────────────────────────────────

export const getActivePeriod = () =>
  invoke<Period>('get_active_period');

export const listPeriods = () =>
  invoke<Period[]>('list_periods');

export const setActivePeriod = (year: number, month: number) =>
  invoke<Period>('set_active_period', { year, month });

export const closePeriod = (id: number) =>
  invoke<void>('close_period', { id });

// ── Eventos ───────────────────────────────────────────────────────────────────

export const listEvents = (periodId: number) =>
  invoke<FinancialEventRow[]>('list_events', { periodId });

export const getEvent = (id: number) =>
  invoke<FinancialEventRow | null>('get_event', { id });

export const createEvent = (input: CreateEventInput) =>
  invoke<FinancialEventRow>('create_event', { input });

export const updateEvent = (id: number, input: UpdateEventInput) =>
  invoke<FinancialEventRow>('update_event', { id, input });

export const deleteEvent = (id: number) =>
  invoke<void>('delete_event', { id });

// ── Configuración — categorías ────────────────────────────────────────────────

export const listCategories = () =>
  invoke<Category[]>('list_categories');

export const createCategory = (input: { name: string; color: string; scope: string }) =>
  invoke<Category>('create_category', { input });

export const updateCategory = (id: number, input: { name: string; color: string; scope: string }) =>
  invoke<Category>('update_category', { id, input });

export const toggleCategory = (id: number, enabled: boolean) =>
  invoke<void>('toggle_category', { id, enabled });

export const deleteCategory = (id: number) =>
  invoke<void>('delete_category', { id });

// ── Configuración — estados ────────────────────────────────────────────────────

export const listStatusesWithRules = () =>
  invoke<StatusWithRules[]>('list_statuses_with_rules');

export const createStatus = (input: { name: string; color: string; sort_order: number; scope?: string }) =>
  invoke<StatusWithRules['status']>('create_status', { input });

export const updateStatus = (id: number, input: { name: string; color: string; sort_order: number; scope?: string }) =>
  invoke<StatusWithRules['status']>('update_status', { id, input });

export const upsertStatusRules = (statusId: number, input: UpsertStatusRulesInput) =>
  invoke<void>('upsert_status_rules', { statusId, input });

export const toggleStatus = (id: number, enabled: boolean) =>
  invoke<void>('toggle_status', { id, enabled });

export const deleteStatus = (id: number) =>
  invoke<void>('delete_status', { id });

// ── Configuración — métodos de pago ───────────────────────────────────────────

export const listPaymentMethods = () =>
  invoke<PaymentMethod[]>('list_payment_methods');

export interface PaymentMethodInput {
  name: string;
  kind: string;
  asset_account_id?: number;
  liability_account_id?: number;
  credit_limit_minor?: number;
  cut_day?: number;
  payment_due_day?: number;
}

export const createPaymentMethod = (input: PaymentMethodInput) =>
  invoke<PaymentMethod>('create_payment_method', { input });

export const updatePaymentMethod = (id: number, input: PaymentMethodInput) =>
  invoke<PaymentMethod>('update_payment_method', { id, input });

export const listCreditCardBalances = (periodId: number) =>
  invoke<CreditCardBalance[]>('list_credit_card_balances', { periodId });

export const togglePaymentMethod = (id: number, enabled: boolean) =>
  invoke<void>('toggle_payment_method', { id, enabled });

export const deletePaymentMethod = (id: number) =>
  invoke<void>('delete_payment_method', { id });

// ── Configuración — cuentas ───────────────────────────────────────────────────

export const listAccounts = () =>
  invoke<Account[]>('list_accounts');

export const createAccount = (input: {
  name: string;
  kind: string;
  opening_balance_minor: number;
}) => invoke<Account>('create_account', { input });

export const updateAccount = (id: number, input: {
  name: string;
  kind: string;
  opening_balance_minor: number;
}) => invoke<Account>('update_account', { id, input });

export const toggleAccount = (id: number, enabled: boolean) =>
  invoke<void>('toggle_account', { id, enabled });

export const deleteAccount = (id: number) =>
  invoke<void>('delete_account', { id });

// ── Reglas recurrentes ────────────────────────────────────────────────────────

export interface CreateRecurringRuleInput {
  event_type: string;
  title: string;
  amount_minor: number;
  amount_type?: 'fixed' | 'variable';
  frequency: string;
  day_of_month?: number;
  interval_days?: number;
  category_id?: number;
  payment_method_id?: number;
  default_status_id?: number;
  starts_on: string;
  ends_on?: string;
  remind_days_before?: number;
  notes?: string;
}

export const listRecurringRules = () =>
  invoke<RecurringRule[]>('list_recurring_rules');

export const createRecurringRule = (input: CreateRecurringRuleInput) =>
  invoke<RecurringRule>('create_recurring_rule', { input });

export const updateRecurringRule = (id: number, input: CreateRecurringRuleInput) =>
  invoke<RecurringRule>('update_recurring_rule', { id, input });

export const toggleRecurringRule = (id: number, enabled: boolean) =>
  invoke<void>('toggle_recurring_rule', { id, enabled });

export const deleteRecurringRule = (id: number) =>
  invoke<void>('delete_recurring_rule', { id });

export const generateRecurringEvents = (periodId: number) =>
  invoke<number>('generate_recurring_events', { periodId });

export const createRecurringException = (ruleId: number, periodId: number) =>
  invoke<void>('create_recurring_exception', { ruleId, periodId });

export const cancelFutureRecurringEvents = (ruleId: number, fromDate: string) =>
  invoke<number>('cancel_future_recurring_events', { ruleId, fromDate });

// ── Compras en cuotas TC ──────────────────────────────────────────────────────

export interface CreateCreditCardPurchaseInput {
  payment_method_id: number;
  title: string;
  total_amount_minor: number;
  installments: number;
  interest_type: string;
  monthly_interest_rate: number;
  category_id?: number;
  purchase_date: string;
  notes?: string;
}

export const previewInstallments = (
  totalAmountMinor: number,
  installments: number,
  monthlyInterestRate: number,
) => invoke<InstallmentPreview>('preview_installments', { totalAmountMinor, installments, monthlyInterestRate });

export const createCreditCardPurchase = (input: CreateCreditCardPurchaseInput) =>
  invoke<CreditCardPurchase>('create_credit_card_purchase', { input });

export const listCreditCardPurchases = (paymentMethodId?: number) =>
  invoke<CreditCardPurchaseWithProgress[]>('list_credit_card_purchases', { paymentMethodId });

// ── Notificaciones ────────────────────────────────────────────────────────────

export const listNotifications = () =>
  invoke<NotificationItem[]>('list_notifications');

export const markNotificationRead = (
  notifType: string,
  sourceType: string,
  sourceId: number,
) => invoke<void>('mark_notification_read', { notifType, sourceType, sourceId });

/** Descarta la alerta durante 7 días. No modifica ningún estado financiero. */
export const markNotificationDismissed = (
  notifType: string,
  sourceType: string,
  sourceId: number,
) => invoke<void>('mark_notification_dismissed', { notifType, sourceType, sourceId });
