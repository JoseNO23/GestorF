use chrono::{Datelike, NaiveDate};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::db::connection::DbPool;

// ── Struct principal ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RecurringRule {
    pub id: i64,
    pub event_type: String,
    pub title: String,
    pub amount_minor: i64,
    pub frequency: String,
    pub day_of_month: Option<i64>,
    pub interval_days: Option<i64>,
    pub category_id: Option<i64>,
    pub payment_method_id: Option<i64>,
    pub default_status_id: Option<i64>,
    pub starts_on: String,
    pub ends_on: Option<String>,
    pub remind_days_before: Option<i64>,
    pub notes: Option<String>,
    pub archived_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateRecurringRuleInput {
    pub event_type: String,
    pub title: String,
    pub amount_minor: i64,
    pub frequency: String,
    pub day_of_month: Option<i64>,
    pub interval_days: Option<i64>,
    pub category_id: Option<i64>,
    pub payment_method_id: Option<i64>,
    pub default_status_id: Option<i64>,
    pub starts_on: String,
    pub ends_on: Option<String>,
    pub remind_days_before: Option<i64>,
    pub notes: Option<String>,
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

const SELECT_RULE: &str =
    "SELECT id, event_type, title, amount_minor, frequency, day_of_month, interval_days,
            category_id, payment_method_id, default_status_id,
            starts_on, ends_on, remind_days_before, notes, archived_at, created_at
     FROM recurring_rules";

pub async fn list_recurring_rules(pool: &DbPool) -> Result<Vec<RecurringRule>, sqlx::Error> {
    sqlx::query_as::<_, RecurringRule>(&format!(
        "{SELECT_RULE} ORDER BY archived_at, event_type, title"
    ))
    .fetch_all(pool)
    .await
}

pub async fn get_recurring_rule(
    pool: &DbPool,
    id: i64,
) -> Result<Option<RecurringRule>, sqlx::Error> {
    sqlx::query_as::<_, RecurringRule>(&format!("{SELECT_RULE} WHERE id = ?"))
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_recurring_rule(
    pool: &DbPool,
    input: CreateRecurringRuleInput,
) -> Result<RecurringRule, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO recurring_rules
            (event_type, title, amount_minor, frequency, day_of_month, interval_days,
             category_id, payment_method_id, default_status_id,
             starts_on, ends_on, remind_days_before, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&input.event_type)
    .bind(&input.title)
    .bind(input.amount_minor)
    .bind(&input.frequency)
    .bind(input.day_of_month)
    .bind(input.interval_days)
    .bind(input.category_id)
    .bind(input.payment_method_id)
    .bind(input.default_status_id)
    .bind(&input.starts_on)
    .bind(&input.ends_on)
    .bind(input.remind_days_before)
    .bind(&input.notes)
    .execute(pool)
    .await?;

    let id = result.last_insert_rowid();
    get_recurring_rule(pool, id)
        .await
        .map(|r| r.expect("recién insertado"))
}

pub async fn update_recurring_rule(
    pool: &DbPool,
    id: i64,
    input: CreateRecurringRuleInput,
) -> Result<RecurringRule, sqlx::Error> {
    sqlx::query(
        "UPDATE recurring_rules SET
            event_type = ?, title = ?, amount_minor = ?, frequency = ?,
            day_of_month = ?, interval_days = ?,
            category_id = ?, payment_method_id = ?, default_status_id = ?,
            starts_on = ?, ends_on = ?, remind_days_before = ?, notes = ?
         WHERE id = ?",
    )
    .bind(&input.event_type)
    .bind(&input.title)
    .bind(input.amount_minor)
    .bind(&input.frequency)
    .bind(input.day_of_month)
    .bind(input.interval_days)
    .bind(input.category_id)
    .bind(input.payment_method_id)
    .bind(input.default_status_id)
    .bind(&input.starts_on)
    .bind(&input.ends_on)
    .bind(input.remind_days_before)
    .bind(&input.notes)
    .bind(id)
    .execute(pool)
    .await?;

    get_recurring_rule(pool, id)
        .await
        .map(|r| r.expect("existe tras update"))
}

pub async fn toggle_recurring_rule(
    pool: &DbPool,
    id: i64,
    enabled: bool,
) -> Result<(), sqlx::Error> {
    let sql = if enabled {
        "UPDATE recurring_rules SET archived_at = NULL WHERE id = ?"
    } else {
        "UPDATE recurring_rules SET archived_at = datetime('now') WHERE id = ?"
    };
    sqlx::query(sql).bind(id).execute(pool).await?;
    Ok(())
}

pub async fn delete_recurring_rule(pool: &DbPool, id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM recurring_rules WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

// ── Generación automática ─────────────────────────────────────────────────────

/// Retorna el último día del mes (1-indexed).
fn last_day_of_month(year: i32, month: u32) -> u32 {
    let next_month = if month == 12 { 1 } else { month + 1 };
    let next_year = if month == 12 { year + 1 } else { year };
    NaiveDate::from_ymd_opt(next_year, next_month, 1)
        .unwrap()
        .pred_opt()
        .unwrap()
        .day()
}

/// Genera los eventos del período para todas las reglas activas que aún no
/// tengan un evento generado en ese período. Devuelve el número de eventos creados.
pub async fn generate_for_period(
    pool: &DbPool,
    period_id: i64,
    period_year: i64,
    period_month: i64,
) -> Result<u32, sqlx::Error> {
    let year = period_year as i32;
    let month = period_month as u32;
    let period_start = NaiveDate::from_ymd_opt(year, month, 1).unwrap();
    let last_day = last_day_of_month(year, month);
    let period_end = NaiveDate::from_ymd_opt(year, month, last_day).unwrap();

    let period_start_str = period_start.format("%Y-%m-%d").to_string();
    let period_end_str = period_end.format("%Y-%m-%d").to_string();

    // Reglas activas cuyo rango solapa con el período
    let rules = sqlx::query_as::<_, RecurringRule>(&format!(
        "{SELECT_RULE}
         WHERE archived_at IS NULL
           AND starts_on <= ?
           AND (ends_on IS NULL OR ends_on >= ?)"
    ))
    .bind(&period_end_str)
    .bind(&period_start_str)
    .fetch_all(pool)
    .await?;

    let mut created = 0u32;

    for rule in rules {
        // ¿Ya existe un evento de esta regla en el período?
        let exists: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM financial_events
             WHERE period_id = ? AND recurring_rule_id = ?",
        )
        .bind(period_id)
        .bind(rule.id)
        .fetch_one(pool)
        .await?;

        if exists.0 > 0 {
            continue;
        }

        // Calcular el día del mes (clamped al último día del mes)
        let dom = rule.day_of_month.unwrap_or(1).clamp(1, last_day as i64) as u32;
        let event_date = NaiveDate::from_ymd_opt(year, month, dom).unwrap();
        let event_date_str = event_date.format("%Y-%m-%d").to_string();

        // Estado por defecto: usar el de la regla o el primero disponible
        let status_id: i64 = if let Some(sid) = rule.default_status_id {
            sid
        } else {
            let row: (i64,) = sqlx::query_as(
                "SELECT id FROM statuses WHERE archived_at IS NULL ORDER BY sort_order LIMIT 1",
            )
            .fetch_one(pool)
            .await?;
            row.0
        };

        sqlx::query(
            "INSERT INTO financial_events
                (period_id, type, title, amount_minor, event_date, due_date,
                 status_id, category_id, payment_method_id, exclude_from_total,
                 recurring_rule_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)",
        )
        .bind(period_id)
        .bind(&rule.event_type)
        .bind(&rule.title)
        .bind(rule.amount_minor)
        .bind(&event_date_str)
        .bind(&event_date_str) // due_date = mismo día por defecto
        .bind(status_id)
        .bind(rule.category_id)
        .bind(rule.payment_method_id)
        .bind(rule.id)
        .execute(pool)
        .await?;

        created += 1;
    }

    Ok(created)
}
