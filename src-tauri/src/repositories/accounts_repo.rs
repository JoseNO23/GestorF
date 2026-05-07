use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::db::connection::DbPool;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Account {
    pub id: i64,
    pub name: String,
    pub kind: String, // "asset" | "liability" | "receivable"
    pub opening_balance_minor: i64,
    pub archived_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateAccountInput {
    pub name: String,
    pub kind: String,
    pub opening_balance_minor: i64,
}

pub async fn list_accounts(pool: &DbPool) -> Result<Vec<Account>, sqlx::Error> {
    sqlx::query_as::<_, Account>(
        "SELECT id, name, kind, opening_balance_minor, archived_at
         FROM accounts
         ORDER BY archived_at, kind, name",
    )
    .fetch_all(pool)
    .await
}

pub async fn create_account(
    pool: &DbPool,
    input: CreateAccountInput,
) -> Result<Account, sqlx::Error> {
    let result = sqlx::query(
        "INSERT INTO accounts (name, kind, opening_balance_minor)
         VALUES (?, ?, ?)",
    )
    .bind(&input.name)
    .bind(&input.kind)
    .bind(input.opening_balance_minor)
    .execute(pool)
    .await?;

    let id = result.last_insert_rowid();

    sqlx::query_as::<_, Account>(
        "SELECT id, name, kind, opening_balance_minor, archived_at
         FROM accounts WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await
}

pub async fn update_account(
    pool: &DbPool,
    id: i64,
    input: CreateAccountInput,
) -> Result<Account, sqlx::Error> {
    sqlx::query(
        "UPDATE accounts SET name = ?, kind = ?, opening_balance_minor = ? WHERE id = ?",
    )
    .bind(&input.name)
    .bind(&input.kind)
    .bind(input.opening_balance_minor)
    .bind(id)
    .execute(pool)
    .await?;
    sqlx::query_as::<_, Account>(
        "SELECT id, name, kind, opening_balance_minor, archived_at FROM accounts WHERE id = ?",
    )
    .bind(id)
    .fetch_one(pool)
    .await
}

pub async fn toggle_account(pool: &DbPool, id: i64, enabled: bool) -> Result<(), sqlx::Error> {
    let sql = if enabled {
        "UPDATE accounts SET archived_at = NULL WHERE id = ?"
    } else {
        "UPDATE accounts SET archived_at = datetime('now') WHERE id = ?"
    };
    sqlx::query(sql).bind(id).execute(pool).await?;
    Ok(())
}

pub async fn delete_account(pool: &DbPool, id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM accounts WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

/// Suma el saldo inicial de todas las cuentas asset activas.
/// Es el punto de partida de dinero_real.
pub async fn get_asset_opening_balance(pool: &DbPool) -> Result<i64, sqlx::Error> {
    let row: (i64,) = sqlx::query_as(
        "SELECT COALESCE(SUM(opening_balance_minor), 0)
         FROM accounts
         WHERE kind = 'asset' AND archived_at IS NULL",
    )
    .fetch_one(pool)
    .await?;
    Ok(row.0)
}
