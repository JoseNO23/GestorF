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

pub async fn list_categories(pool: &DbPool) -> Result<Vec<Category>, sqlx::Error> {
    sqlx::query_as::<_, Category>(
        "SELECT id, name, color, scope, archived_at
         FROM categories
         WHERE archived_at IS NULL
         ORDER BY name",
    )
    .fetch_all(pool)
    .await
}

pub async fn create_category(
    pool: &DbPool,
    input: CreateCategoryInput,
) -> Result<Category, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO categories (name, color, scope) VALUES (?, ?, ?)",
    )
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

pub async fn archive_category(pool: &DbPool, id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE categories SET archived_at = datetime('now') WHERE id = ?")
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
    pub archived_at: Option<String>,
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
        "SELECT id, name, color, sort_order, archived_at
         FROM statuses
         WHERE archived_at IS NULL
         ORDER BY sort_order, name",
    )
    .fetch_all(pool)
    .await
}

pub async fn list_statuses_with_rules(
    pool: &DbPool,
) -> Result<Vec<StatusWithRules>, sqlx::Error> {
    let statuses = list_statuses(pool).await?;
    let rules = sqlx::query_as::<_, StatusRuleRow>(
        "SELECT status_id, applies_to, counts_as_paid, affects_real,
                affects_available, affects_future, creates_alert, exclude_from_total_default
         FROM status_rules",
    )
    .fetch_all(pool)
    .await?;

    let mut rules_by_status: HashMap<i64, Vec<StatusRuleRow>> = HashMap::new();
    for rule in rules {
        rules_by_status.entry(rule.status_id).or_default().push(rule);
    }

    Ok(statuses
        .into_iter()
        .map(|s| {
            let rules = rules_by_status.remove(&s.id).unwrap_or_default();
            StatusWithRules { status: s, rules }
        })
        .collect())
}

pub async fn create_status(
    pool: &DbPool,
    input: CreateStatusInput,
) -> Result<Status, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO statuses (name, color, sort_order) VALUES (?, ?, ?)",
    )
    .bind(&input.name)
    .bind(&input.color)
    .bind(input.sort_order)
    .execute(pool)
    .await?;

    let id = result.last_insert_rowid();
    sqlx::query_as::<_, Status>(
        "SELECT id, name, color, sort_order, archived_at FROM statuses WHERE id = ?",
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
    pub archived_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePaymentMethodInput {
    pub name: String,
    pub kind: String,
    pub asset_account_id: Option<i64>,
    pub liability_account_id: Option<i64>,
}

pub async fn list_payment_methods(pool: &DbPool) -> Result<Vec<PaymentMethod>, sqlx::Error> {
    sqlx::query_as::<_, PaymentMethod>(
        "SELECT id, name, kind, asset_account_id, liability_account_id, archived_at
         FROM payment_methods
         WHERE archived_at IS NULL
         ORDER BY name",
    )
    .fetch_all(pool)
    .await
}

pub async fn create_payment_method(
    pool: &DbPool,
    input: CreatePaymentMethodInput,
) -> Result<PaymentMethod, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO payment_methods (name, kind, asset_account_id, liability_account_id)
         VALUES (?, ?, ?, ?)",
    )
    .bind(&input.name)
    .bind(&input.kind)
    .bind(input.asset_account_id)
    .bind(input.liability_account_id)
    .execute(pool)
    .await?;

    let id = result.last_insert_rowid();
    sqlx::query_as::<_, PaymentMethod>(
        "SELECT id, name, kind, asset_account_id, liability_account_id, archived_at
         FROM payment_methods WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await
}

pub async fn archive_payment_method(pool: &DbPool, id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE payment_methods SET archived_at = datetime('now') WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}
