use chrono::{Datelike, NaiveDate};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::db::connection::DbPool;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Period {
    pub id: i64,
    pub year: i64,
    pub month: i64,
    pub starts_on: String,
    pub ends_on: String,
    pub closed_at: Option<String>,
}

pub async fn list_periods(pool: &DbPool) -> Result<Vec<Period>, sqlx::Error> {
    sqlx::query_as::<_, Period>(
        "SELECT id, year, month, starts_on, ends_on, closed_at
         FROM periods
         ORDER BY year DESC, month DESC",
    )
    .fetch_all(pool)
    .await
}

pub async fn get_period(pool: &DbPool, id: i64) -> Result<Option<Period>, sqlx::Error> {
    sqlx::query_as::<_, Period>(
        "SELECT id, year, month, starts_on, ends_on, closed_at
         FROM periods WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
}

pub async fn get_or_create_period(
    pool: &DbPool,
    year: i32,
    month: u32,
) -> Result<Period, sqlx::Error> {
    if let Some(existing) = sqlx::query_as::<_, Period>(
        "SELECT id, year, month, starts_on, ends_on, closed_at
         FROM periods WHERE year = ? AND month = ?",
    )
    .bind(year as i64)
    .bind(month as i64)
    .fetch_optional(pool)
    .await?
    {
        return Ok(existing);
    }

    let starts_on = NaiveDate::from_ymd_opt(year, month, 1)
        .expect("fecha inválida")
        .to_string();

    let last_day = last_day_of_month(year, month);
    let ends_on = NaiveDate::from_ymd_opt(year, month, last_day)
        .expect("fecha inválida")
        .to_string();

    let result = sqlx::query(
        "INSERT INTO periods (year, month, starts_on, ends_on)
         VALUES (?, ?, ?, ?)",
    )
    .bind(year as i64)
    .bind(month as i64)
    .bind(&starts_on)
    .bind(&ends_on)
    .execute(pool)
    .await?;

    let id = result.last_insert_rowid();

    sqlx::query_as::<_, Period>(
        "SELECT id, year, month, starts_on, ends_on, closed_at
         FROM periods WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await
}

pub async fn close_period(pool: &DbPool, id: i64) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE periods SET closed_at = datetime('now') WHERE id = ? AND closed_at IS NULL",
    )
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_active_period(pool: &DbPool) -> Result<Option<Period>, sqlx::Error> {
    // Dos queries separados: primero el ID, luego el período.
    // El LEFT JOIN con active_period_id=NULL devolvería columnas nulas que sqlx
    // no puede decodificar en un Period con campos no-opcionales.
    let row: Option<(Option<i64>,)> =
        sqlx::query_as("SELECT active_period_id FROM app_settings WHERE id = 1")
            .fetch_optional(pool)
            .await?;

    let period_id = match row {
        Some((Some(id),)) => id,
        _ => return Ok(None),
    };

    get_period(pool, period_id).await
}

pub async fn set_active_period(pool: &DbPool, period_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE app_settings SET active_period_id = ? WHERE id = 1")
        .bind(period_id)
        .execute(pool)
        .await?;
    Ok(())
}

fn last_day_of_month(year: i32, month: u32) -> u32 {
    let next_month = if month == 12 {
        NaiveDate::from_ymd_opt(year + 1, 1, 1)
    } else {
        NaiveDate::from_ymd_opt(year, month + 1, 1)
    };
    next_month
        .expect("fecha inválida")
        .pred_opt()
        .expect("fecha inválida")
        .day()
}
