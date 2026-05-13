use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use std::collections::HashMap;

use crate::db::connection::DbPool;
use crate::domain::event_rules::{RulesMap, StatusRules};

// ── Categorías ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub scope: String, // "income" | "expense" | "both"
    pub archived_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCategoryInput {
    pub name: String,
    pub color: String,
    pub scope: String,
}

/// Devuelve TODAS las categorías (activas y archivadas). El frontend separa.
pub async fn list_categories(pool: &DbPool) -> Result<Vec<Category>, sqlx::Error> {
    sqlx::query_as::<_, Category>(
        "SELECT id, name, color, scope, archived_at
         FROM categories
         ORDER BY archived_at, name",
    )
    .fetch_all(pool)
    .await
}

pub async fn create_category(
    pool: &DbPool,
    input: CreateCategoryInput,
) -> Result<Category, sqlx::Error> {
    let result = sqlx::query("INSERT INTO categories (name, color, scope) VALUES (?, ?, ?)")
        .bind(&input.name)
        .bind(&input.color)
        .bind(&input.scope)
        .execute(pool)
        .await?;
    let id = result.last_insert_rowid();
    sqlx::query_as::<_, Category>(
        "SELECT id, name, color, scope, archived_at FROM categories WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await
}

pub async fn update_category(
    pool: &DbPool,
    id: i64,
    input: CreateCategoryInput,
) -> Result<Category, sqlx::Error> {
    sqlx::query("UPDATE categories SET name = ?, color = ?, scope = ? WHERE id = ?")
        .bind(&input.name)
        .bind(&input.color)
        .bind(&input.scope)
        .bind(id)
        .execute(pool)
        .await?;
    sqlx::query_as::<_, Category>(
        "SELECT id, name, color, scope, archived_at FROM categories WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await
}

pub async fn toggle_category(pool: &DbPool, id: i64, enabled: bool) -> Result<(), sqlx::Error> {
    let sql = if enabled {
        "UPDATE categories SET archived_at = NULL WHERE id = ?"
    } else {
        "UPDATE categories SET archived_at = datetime('now') WHERE id = ?"
    };
    sqlx::query(sql).bind(id).execute(pool).await?;
    Ok(())
}

pub async fn delete_category(pool: &DbPool, id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM categories WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

// ── Estados ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Status {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub sort_order: i64,
    pub scope: String, // "income" | "expense" | "both"
    pub archived_at: Option<String>,
    pub system_key: Option<String>, // semántica interna — NO editable por usuario
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct StatusRuleRow {
    pub status_id: i64,
    pub applies_to: String,
    pub counts_as_paid: bool,
    pub affects_real: bool,
    pub affects_available: bool,
    pub affects_future: bool,
    pub creates_alert: bool,
    pub exclude_from_total_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StatusWithRules {
    pub status: Status,
    pub rules: Vec<StatusRuleRow>,
}

#[derive(Debug, Deserialize)]
pub struct CreateStatusInput {
    pub name: String,
    pub color: String,
    pub sort_order: i64,
    pub scope: Option<String>, // "income" | "expense" | "both"; default "both"
}

#[derive(Debug, Deserialize)]
pub struct UpsertStatusRulesInput {
    pub applies_to: String,
    pub counts_as_paid: bool,
    pub affects_real: bool,
    pub affects_available: bool,
    pub affects_future: bool,
    pub creates_alert: bool,
    pub exclude_from_total_default: bool,
}

pub async fn list_statuses(pool: &DbPool) -> Result<Vec<Status>, sqlx::Error> {
    sqlx::query_as::<_, Status>(
        "SELECT id, name, color, sort_order, scope, archived_at, system_key
         FROM statuses
         WHERE archived_at IS NULL
         ORDER BY sort_order, name",
    )
    .fetch_all(pool)
    .await
}

pub async fn list_statuses_with_rules(pool: &DbPool) -> Result<Vec<StatusWithRules>, sqlx::Error> {
    // Devuelve TODOS los estados (habilitados y deshabilitados).
    // El frontend decide cuáles mostrar en cada contexto.
    let statuses = sqlx::query_as::<_, Status>(
        "SELECT id, name, color, sort_order, scope, archived_at, system_key
         FROM statuses
         ORDER BY sort_order, name",
    )
    .fetch_all(pool)
    .await?;
    let rules = sqlx::query_as::<_, StatusRuleRow>(
        "SELECT status_id, applies_to, counts_as_paid, affects_real,
                affects_available, affects_future, creates_alert, exclude_from_total_default
         FROM status_rules",
    )
    .fetch_all(pool)
    .await?;

    let mut rules_by_status: HashMap<i64, Vec<StatusRuleRow>> = HashMap::new();
    for rule in rules {
        rules_by_status
            .entry(rule.status_id)
            .or_default()
            .push(rule);
    }

    Ok(statuses
        .into_iter()
        .map(|s| {
            let rules = rules_by_status.remove(&s.id).unwrap_or_default();
            StatusWithRules { status: s, rules }
        })
        .collect())
}

/// Habilita (enabled=true) o deshabilita (enabled=false) un estado.
/// Los estados deshabilitados no aparecen en formularios pero sus reglas
/// y referencias históricas en eventos se conservan intactas.
pub async fn toggle_status(pool: &DbPool, id: i64, enabled: bool) -> Result<(), sqlx::Error> {
    let sql = if enabled {
        "UPDATE statuses SET archived_at = NULL WHERE id = ?"
    } else {
        "UPDATE statuses SET archived_at = datetime('now') WHERE id = ?"
    };
    sqlx::query(sql).bind(id).execute(pool).await?;
    Ok(())
}

/// Elimina un estado permanentemente.
/// Falla si el estado tiene system_key (estado del sistema, no borrable).
/// Falla con FK constraint si algún evento lo está usando.
pub async fn delete_status(pool: &DbPool, id: i64) -> Result<(), Box<dyn std::error::Error>> {
    let row: Option<(Option<String>,)> =
        sqlx::query_as("SELECT system_key FROM statuses WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?;

    if let Some((Some(key),)) = row {
        return Err(format!(
            "El estado \"{key}\" es un estado del sistema y no puede eliminarse. Usa \"deshabilitar\" en su lugar."
        ).into());
    }

    sqlx::query("DELETE FROM statuses WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn update_status(
    pool: &DbPool,
    id: i64,
    input: CreateStatusInput,
) -> Result<Status, sqlx::Error> {
    let scope = input.scope.as_deref().unwrap_or("both");
    sqlx::query("UPDATE statuses SET name = ?, color = ?, sort_order = ?, scope = ? WHERE id = ?")
        .bind(&input.name)
        .bind(&input.color)
        .bind(input.sort_order)
        .bind(scope)
        .bind(id)
        .execute(pool)
        .await?;
    sqlx::query_as::<_, Status>(
        "SELECT id, name, color, sort_order, scope, archived_at, system_key FROM statuses WHERE id = ?",
    )
    .bind(id).fetch_one(pool).await
}

pub async fn create_status(pool: &DbPool, input: CreateStatusInput) -> Result<Status, sqlx::Error> {
    let scope = input.scope.as_deref().unwrap_or("both");
    let result =
        sqlx::query("INSERT INTO statuses (name, color, sort_order, scope) VALUES (?, ?, ?, ?)")
            .bind(&input.name)
            .bind(&input.color)
            .bind(input.sort_order)
            .bind(scope)
            .execute(pool)
            .await?;

    let id = result.last_insert_rowid();
    sqlx::query_as::<_, Status>(
        "SELECT id, name, color, sort_order, scope, archived_at, system_key FROM statuses WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await
}

pub async fn upsert_status_rules(
    pool: &DbPool,
    status_id: i64,
    input: UpsertStatusRulesInput,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO status_rules
            (status_id, applies_to, counts_as_paid, affects_real,
             affects_available, affects_future, creates_alert, exclude_from_total_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(status_id, applies_to) DO UPDATE SET
            counts_as_paid = excluded.counts_as_paid,
            affects_real = excluded.affects_real,
            affects_available = excluded.affects_available,
            affects_future = excluded.affects_future,
            creates_alert = excluded.creates_alert,
            exclude_from_total_default = excluded.exclude_from_total_default",
    )
    .bind(status_id)
    .bind(&input.applies_to)
    .bind(input.counts_as_paid)
    .bind(input.affects_real)
    .bind(input.affects_available)
    .bind(input.affects_future)
    .bind(input.creates_alert)
    .bind(input.exclude_from_total_default)
    .execute(pool)
    .await?;
    Ok(())
}

/// Carga el RulesMap del dominio desde la base de datos.
/// Toma la primera regla de cada estado (applies_to = 'all' tiene prioridad).
pub async fn load_rules_map(pool: &DbPool) -> Result<RulesMap, sqlx::Error> {
    let rows = sqlx::query_as::<_, StatusRuleRow>(
        "SELECT status_id, applies_to, counts_as_paid, affects_real,
                affects_available, affects_future, creates_alert, exclude_from_total_default
         FROM status_rules
         ORDER BY status_id,
                  CASE applies_to WHEN 'all' THEN 0 ELSE 1 END",
    )
    .fetch_all(pool)
    .await?;

    let mut map: RulesMap = HashMap::new();
    for row in rows {
        // La primera entrada por status_id gana ('all' tiene prioridad)
        map.entry(row.status_id).or_insert_with(|| StatusRules {
            counts_as_paid: row.counts_as_paid,
            affects_real: row.affects_real,
            affects_available: row.affects_available,
            affects_future: row.affects_future,
            creates_alert: row.creates_alert,
            exclude_from_total_default: row.exclude_from_total_default,
        });
    }
    Ok(map)
}

// ── Métodos de pago ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PaymentMethod {
    pub id: i64,
    pub name: String,
    pub kind: String, // "cash" | "debit" | "credit" | "transfer" | "other"
    pub asset_account_id: Option<i64>,
    pub liability_account_id: Option<i64>,
    pub credit_limit_minor: i64,
    pub cut_day: Option<i64>,
    pub payment_due_day: Option<i64>,
    pub archived_at: Option<String>,
}

/// Balance de una tarjeta de crédito.
/// current_debt = compras históricas − pagos históricos (acumulado global, no por mes).
/// available = límite − current_debt.
/// month_* son informativos del período visible.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreditCardBalance {
    pub id: i64,
    pub name: String,
    pub credit_limit_minor: i64,
    pub cut_day: Option<i64>,
    pub payment_due_day: Option<i64>,
    // Global (acumulado histórico)
    pub current_debt_minor: i64,
    pub available_minor: i64,
    // Mensual (informativo del período visible)
    pub month_purchases_minor: i64,
    pub month_payments_minor: i64,
}

// Struct intermedio para FromRow
#[derive(FromRow)]
struct CreditCardCalcRow {
    id: i64,
    name: String,
    credit_limit_minor: i64,
    cut_day: Option<i64>,
    payment_due_day: Option<i64>,
    total_purchases_minor: i64,
    total_payments_minor: i64,
    month_purchases_minor: i64,
    month_payments_minor: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreatePaymentMethodInput {
    pub name: String,
    pub kind: String,
    pub asset_account_id: Option<i64>,
    pub liability_account_id: Option<i64>,
    pub credit_limit_minor: Option<i64>,
    pub cut_day: Option<i64>,
    pub payment_due_day: Option<i64>,
}

const SELECT_PAYMENT_METHOD: &str = "SELECT id, name, kind, asset_account_id, liability_account_id,
            credit_limit_minor, cut_day, payment_due_day, archived_at
     FROM payment_methods";

/// Devuelve TODOS los métodos (activos y archivados). El frontend separa.
pub async fn list_payment_methods(pool: &DbPool) -> Result<Vec<PaymentMethod>, sqlx::Error> {
    sqlx::query_as::<_, PaymentMethod>(&format!(
        "{SELECT_PAYMENT_METHOD} ORDER BY archived_at, name"
    ))
    .fetch_all(pool)
    .await
}

/// Calcula el balance real de cada TC.
/// La deuda es GLOBAL (acumulada en todos los períodos), no reiniciable mensualmente.
/// - current_debt = compras históricas − pagos históricos
/// - available    = límite − current_debt
/// - month_*      = informativo del período visible (period_id)
pub async fn list_credit_card_balances(
    pool: &DbPool,
    period_id: i64,
) -> Result<Vec<CreditCardBalance>, sqlx::Error> {
    let rows = sqlx::query_as::<_, CreditCardCalcRow>(
        "SELECT
             pm.id,
             pm.name,
             pm.credit_limit_minor,
             pm.cut_day,
             pm.payment_due_day,

             -- Global acumulado (compras de todos los períodos).
             -- Excluye eventos cuyo estado tiene exclude_from_total_default=1 (cancelados,
             -- devoluciones, etc.) que no representan deuda real con el banco.
             COALESCE(SUM(CASE
                 WHEN fe.type IN ('expense', 'debt_charge')
                  AND NOT EXISTS (
                    SELECT 1 FROM status_rules sr2
                    WHERE sr2.status_id = fe.status_id
                      AND sr2.applies_to = 'all'
                      AND sr2.exclude_from_total_default = 1
                  )
                 THEN fe.amount_minor ELSE 0 END), 0) AS total_purchases_minor,

             -- Global acumulado (pagos de todos los períodos)
             COALESCE(SUM(CASE WHEN fe.type = 'debt_payment'
                               THEN fe.amount_minor ELSE 0 END), 0) AS total_payments_minor,

             -- Compras del mes visible (informativo, mismo filtro de cancelados)
             COALESCE(SUM(CASE
                 WHEN fe.type IN ('expense', 'debt_charge')
                  AND fe.period_id = ?
                  AND NOT EXISTS (
                    SELECT 1 FROM status_rules sr2
                    WHERE sr2.status_id = fe.status_id
                      AND sr2.applies_to = 'all'
                      AND sr2.exclude_from_total_default = 1
                  )
                 THEN fe.amount_minor ELSE 0 END), 0) AS month_purchases_minor,

             -- Pagos del mes visible (informativo)
             COALESCE(SUM(CASE WHEN fe.type = 'debt_payment'
                                AND fe.period_id = ?
                               THEN fe.amount_minor ELSE 0 END), 0) AS month_payments_minor

         FROM payment_methods pm
         LEFT JOIN financial_events fe ON fe.payment_method_id = pm.id
         WHERE pm.kind = 'credit' AND pm.archived_at IS NULL
         GROUP BY pm.id
         ORDER BY pm.name",
    )
    .bind(period_id)
    .bind(period_id)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| {
            let current_debt = r.total_purchases_minor - r.total_payments_minor;
            let available = (r.credit_limit_minor - current_debt).max(0);
            CreditCardBalance {
                id: r.id,
                name: r.name,
                credit_limit_minor: r.credit_limit_minor,
                cut_day: r.cut_day,
                payment_due_day: r.payment_due_day,
                current_debt_minor: current_debt,
                available_minor: available,
                month_purchases_minor: r.month_purchases_minor,
                month_payments_minor: r.month_payments_minor,
            }
        })
        .collect())
}

pub async fn create_payment_method(
    pool: &DbPool,
    input: CreatePaymentMethodInput,
) -> Result<PaymentMethod, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO payment_methods
            (name, kind, asset_account_id, liability_account_id,
             credit_limit_minor, cut_day, payment_due_day)
         VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&input.name)
    .bind(&input.kind)
    .bind(input.asset_account_id)
    .bind(input.liability_account_id)
    .bind(input.credit_limit_minor.unwrap_or(0))
    .bind(input.cut_day)
    .bind(input.payment_due_day)
    .execute(pool)
    .await?;
    let id = result.last_insert_rowid();
    sqlx::query_as::<_, PaymentMethod>(&format!("{SELECT_PAYMENT_METHOD} WHERE id = ?"))
        .bind(id)
        .fetch_one(pool)
        .await
}

pub async fn update_payment_method(
    pool: &DbPool,
    id: i64,
    input: CreatePaymentMethodInput,
) -> Result<PaymentMethod, sqlx::Error> {
    sqlx::query(
        "UPDATE payment_methods SET name = ?, kind = ?,
         asset_account_id = ?, liability_account_id = ?,
         credit_limit_minor = ?, cut_day = ?, payment_due_day = ?
         WHERE id = ?",
    )
    .bind(&input.name)
    .bind(&input.kind)
    .bind(input.asset_account_id)
    .bind(input.liability_account_id)
    .bind(input.credit_limit_minor.unwrap_or(0))
    .bind(input.cut_day)
    .bind(input.payment_due_day)
    .bind(id)
    .execute(pool)
    .await?;
    sqlx::query_as::<_, PaymentMethod>(&format!("{SELECT_PAYMENT_METHOD} WHERE id = ?"))
        .bind(id)
        .fetch_one(pool)
        .await
}

pub async fn toggle_payment_method(
    pool: &DbPool,
    id: i64,
    enabled: bool,
) -> Result<(), sqlx::Error> {
    let sql = if enabled {
        "UPDATE payment_methods SET archived_at = NULL WHERE id = ?"
    } else {
        "UPDATE payment_methods SET archived_at = datetime('now') WHERE id = ?"
    };
    sqlx::query(sql).bind(id).execute(pool).await?;
    Ok(())
}

pub async fn delete_payment_method(pool: &DbPool, id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM payment_methods WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
