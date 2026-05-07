use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::db::connection::DbPool;
use crate::domain::{
    credit_card::PaymentMethodKind,
    event_rules::EventType,
    projections::EventForCalc,
};

// ── Structs de DB ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FinancialEventRow {
    pub id: i64,
    pub period_id: i64,
    pub event_type: String,
    pub title: String,
    pub amount_minor: i64,
    pub event_date: String,
    pub due_date: Option<String>,
    pub status_id: i64,
    pub category_id: Option<i64>,
    pub payment_method_id: Option<i64>,
    pub source_account_id: Option<i64>,
    pub target_account_id: Option<i64>,
    pub liability_account_id: Option<i64>,
    pub parent_event_id: Option<i64>,
    pub exclude_from_total: bool,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateEventInput {
    pub period_id: i64,
    pub event_type: String,
    pub title: String,
    pub amount_minor: i64,
    pub event_date: String,
    pub due_date: Option<String>,
    pub status_id: i64,
    pub category_id: Option<i64>,
    pub payment_method_id: Option<i64>,
    pub source_account_id: Option<i64>,
    pub target_account_id: Option<i64>,
    pub liability_account_id: Option<i64>,
    pub parent_event_id: Option<i64>,
    pub exclude_from_total: bool,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateEventInput {
    pub event_type: Option<String>, // si None, conserva el tipo existente
    pub title: String,
    pub amount_minor: i64,
    pub event_date: String,
    pub due_date: Option<String>,
    pub status_id: i64,
    pub category_id: Option<i64>,
    pub payment_method_id: Option<i64>,
    pub parent_event_id: Option<i64>,
    pub exclude_from_total: bool,
    pub notes: Option<String>,
}

// ── Filtros ───────────────────────────────────────────────────────────────────

#[derive(Debug, Default, Deserialize)]
pub struct EventFilters {
    pub event_type: Option<String>,
    pub status_id: Option<i64>,
    pub category_id: Option<i64>,
}

// ── Queries ───────────────────────────────────────────────────────────────────

const SELECT_EVENT: &str =
    "SELECT id, period_id, type as event_type, title, amount_minor,
            event_date, due_date, status_id, category_id, payment_method_id,
            source_account_id, target_account_id, liability_account_id,
            parent_event_id, exclude_from_total, notes, created_at, updated_at
     FROM financial_events";

pub async fn list_events(
    pool: &DbPool,
    period_id: i64,
) -> Result<Vec<FinancialEventRow>, sqlx::Error> {
    sqlx::query_as::<_, FinancialEventRow>(&format!(
        "{SELECT_EVENT} WHERE period_id = ? ORDER BY event_date DESC, id DESC"
    ))
    .bind(period_id)
    .fetch_all(pool)
    .await
}

pub async fn get_event(
    pool: &DbPool,
    id: i64,
) -> Result<Option<FinancialEventRow>, sqlx::Error> {
    sqlx::query_as::<_, FinancialEventRow>(&format!("{SELECT_EVENT} WHERE id = ?"))
        .bind(id)
        .fetch_optional(pool)
        .await
}

pub async fn create_event(
    pool: &DbPool,
    input: CreateEventInput,
) -> Result<FinancialEventRow, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO financial_events
            (period_id, type, title, amount_minor, event_date, due_date,
             status_id, category_id, payment_method_id, source_account_id,
             target_account_id, liability_account_id, parent_event_id,
             exclude_from_total, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(input.period_id)
    .bind(&input.event_type)
    .bind(&input.title)
    .bind(input.amount_minor)
    .bind(&input.event_date)
    .bind(&input.due_date)
    .bind(input.status_id)
    .bind(input.category_id)
    .bind(input.payment_method_id)
    .bind(input.source_account_id)
    .bind(input.target_account_id)
    .bind(input.liability_account_id)
    .bind(input.parent_event_id)
    .bind(input.exclude_from_total)
    .bind(&input.notes)
    .execute(pool)
    .await?;

    let id = result.last_insert_rowid();
    get_event(pool, id).await.map(|e| e.expect("recién insertado"))
}

pub async fn update_event(
    pool: &DbPool,
    id: i64,
    input: UpdateEventInput,
) -> Result<FinancialEventRow, sqlx::Error> {
    sqlx::query(
        "UPDATE financial_events SET
            type = COALESCE(?, type),
            title = ?, amount_minor = ?, event_date = ?, due_date = ?,
            status_id = ?, category_id = ?, payment_method_id = ?,
            parent_event_id = ?, exclude_from_total = ?, notes = ?,
            updated_at = datetime('now')
         WHERE id = ?",
    )
    .bind(&input.event_type)
    .bind(&input.title)
    .bind(input.amount_minor)
    .bind(&input.event_date)
    .bind(&input.due_date)
    .bind(input.status_id)
    .bind(input.category_id)
    .bind(input.payment_method_id)
    .bind(input.parent_event_id)
    .bind(input.exclude_from_total)
    .bind(&input.notes)
    .bind(id)
    .execute(pool)
    .await?;

    get_event(pool, id).await.map(|e| e.expect("existe tras update"))
}

pub async fn delete_event(pool: &DbPool, id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM financial_events WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

// ── Para cálculos de dominio ──────────────────────────────────────────────────

/// Struct intermedio para el JOIN con payment_methods.
#[derive(FromRow)]
struct EventCalcRow {
    id: i64,
    event_type: String,
    amount_minor: i64,
    status_id: i64,
    method_kind: Option<String>,
    parent_event_id: Option<i64>,
    exclude_from_total: bool,
    due_date: Option<String>,
}

/// Carga los eventos de un período listos para los cálculos del dominio.
/// Hace JOIN con payment_methods para obtener el kind del método.
pub async fn list_events_for_calc(
    pool: &DbPool,
    period_id: i64,
) -> Result<Vec<EventForCalc>, sqlx::Error> {
    let rows = sqlx::query_as::<_, EventCalcRow>(
        "SELECT fe.id,
                fe.type         AS event_type,
                fe.amount_minor,
                fe.status_id,
                pm.kind         AS method_kind,
                fe.parent_event_id,
                fe.exclude_from_total,
                fe.due_date
         FROM financial_events fe
         LEFT JOIN payment_methods pm ON fe.payment_method_id = pm.id
         WHERE fe.period_id = ?",
    )
    .bind(period_id)
    .fetch_all(pool)
    .await?;

    rows.into_iter()
        .map(|r| {
            let event_type = EventType::from_str(&r.event_type)
                .map_err(|e| sqlx::Error::Decode(e.into()))?;
            let method_kind = r
                .method_kind
                .as_deref()
                .map(PaymentMethodKind::from_str)
                .transpose()
                .map_err(|e| sqlx::Error::Decode(e.into()))?;
            Ok(EventForCalc {
                id: r.id,
                event_type,
                amount_minor: r.amount_minor,
                status_id: r.status_id,
                method_kind,
                parent_event_id: r.parent_event_id,
                exclude_from_total: r.exclude_from_total,
                due_date: r.due_date,
            })
        })
        .collect()
}
