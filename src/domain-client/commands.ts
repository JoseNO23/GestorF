// Capa de aislamiento de Tauri.
// Todos los invoke() viven aquí. Al migrar a web, solo este archivo cambia.

import { invoke } from '@tauri-apps/api/core';
import type {
  Account,
  Category,
  CreateEventInput,
  DashboardData,
  FinancialEventRow,
  PaymentMethod,
  Period,
  PeriodEvolution,
  StatusWithRules,
  UpdateEventInput,
  UpsertStatusRulesInput,
} from './types';

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

export const archiveCategory = (id: number) =>
  invoke<void>('archive_category', { id });

// ── Configuración — estados ────────────────────────────────────────────────────

export const listStatusesWithRules = () =>
  invoke<StatusWithRules[]>('list_statuses_with_rules');

export const createStatus = (input: { name: string; color: string; sort_order: number }) =>
  invoke<StatusWithRules['status']>('create_status', { input });

export const upsertStatusRules = (statusId: number, input: UpsertStatusRulesInput) =>
  invoke<void>('upsert_status_rules', { statusId, input });

export const toggleStatus = (id: number, enabled: boolean) =>
  invoke<void>('toggle_status', { id, enabled });

export const deleteStatus = (id: number) =>
  invoke<void>('delete_status', { id });

// ── Configuración — métodos de pago ───────────────────────────────────────────

export const listPaymentMethods = () =>
  invoke<PaymentMethod[]>('list_payment_methods');

export const createPaymentMethod = (input: {
  name: string;
  kind: string;
  asset_account_id?: number;
  liability_account_id?: number;
}) => invoke<PaymentMethod>('create_payment_method', { input });

export const archivePaymentMethod = (id: number) =>
  invoke<void>('archive_payment_method', { id });

// ── Configuración — cuentas ───────────────────────────────────────────────────

export const listAccounts = () =>
  invoke<Account[]>('list_accounts');

export const createAccount = (input: {
  name: string;
  kind: string;
  opening_balance_minor: number;
}) => invoke<Account>('create_account', { input });
